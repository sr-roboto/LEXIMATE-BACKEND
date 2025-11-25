import { AppDataSource } from '@database/db';
import { HttpError } from '@common/libs/http-error';

import { User } from '@user/entities';
import { Course } from '@course/entities/course.entity';
import { Post } from '@post/entities/post.entity';
import { Comment } from '@comment/entities/comment.entity';

import { UpdateCommentDto, CreateCommentDto } from '@comment/dtos';

import { commentEventEmitter } from '@common/events/comment.events';

export class CommentService {
  private readonly commentRepository = AppDataSource.getRepository(Comment);
  private readonly postRepository = AppDataSource.getRepository(Post);
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly courseRepository = AppDataSource.getRepository(Course);

  async create(
    createCommentDto: CreateCommentDto,
    postId: string,
    userId: string
  ) {
    const existingPost = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['course'],
    });
    if (!existingPost) throw HttpError.notFound('Post not found');

    const foundUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses'],
    });
    if (!foundUser) throw HttpError.notFound('User not found');

    const isInClass = foundUser.courses.some(
      (c) => c.id === existingPost.course.id
    );
    if (!isInClass)
      throw HttpError.forbidden('The user does not belong to the class');

    const comment = this.commentRepository.create({
      content: createCommentDto.content,
      post: existingPost,
      user: foundUser,
    });
    await this.commentRepository.save(comment);

    // Get post author and course info for event
    const postWithDetails = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user', 'course'],
    });

    // Emit domain event - handler will create notifications
    if (postWithDetails) {
      // Fetch course with users explicitly to ensure we have the list
      const courseWithUsers = await this.courseRepository.findOne({
        where: { id: postWithDetails.course.id },
        relations: ['users'],
      });

      if (courseWithUsers) {
        console.log('🔍 Debug CommentService:');
        console.log('Course ID:', courseWithUsers.id);
        console.log('Users found in course:', courseWithUsers.users?.length);
        
        commentEventEmitter.emit('comment_created', {
          comment: {
            id: comment.id,
            content: comment.content,
            postId: existingPost.id,
            postTitle: postWithDetails.title,
            authorId: foundUser.id,
            authorName: foundUser.user_name,
            courseId: postWithDetails.course.id,
            createdAt: comment.created_at,
          },
          userIds: courseWithUsers.users.map((u) => u.id),
          postAuthorId: postWithDetails.user.id,
        });
      }
    }

    return comment;
  }

  async readAll(postId: string, page: number = 1, limit: number = 20) {
    const existingPost = await this.postRepository.findOne({
      where: { id: postId },
    });
    if (!existingPost) throw HttpError.notFound('Post not found');

    const skip = (page - 1) * limit;

    const [comments, total] = await this.commentRepository.findAndCount({
      where: { post: { id: existingPost.id } },
      relations: ['user', 'user.people', 'user.userFiles', 'post'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return Object.assign(comments, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  }

  async readOne(commentId: string) {
    const existingComment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'user.people', 'user.userFiles', 'post'],
    });

    if (!existingComment) throw HttpError.notFound('Comment not found');

    return existingComment;
  }

  async update(
    updateCommentDto: UpdateCommentDto,
    commentId: string,
    userId: string
  ) {
    const existingComment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user'],
    });
    if (!existingComment) throw HttpError.notFound('Comment not founds');

    const foundUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!foundUser) throw HttpError.notFound('User not found');

    if (existingComment.user.id !== foundUser.id) {
      throw HttpError.forbidden(
        'You do not have permission to edit this comment.'
      );
    }

    if (updateCommentDto.content)
      existingComment.content = updateCommentDto.content;
    await this.commentRepository.save(existingComment);

    // Emit real-time event for WebSocket broadcast
    const updatedComment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['post', 'post.course', 'user'],
    });

    if (updatedComment?.post?.course) {
      const courseWithUsers = await this.courseRepository.findOne({
        where: { id: updatedComment.post.course.id },
        relations: ['users'],
      });

      if (courseWithUsers?.users) {
        commentEventEmitter.emit('comment_updated', {
          comment: updatedComment,
          userIds: courseWithUsers.users.map((u) => u.id),
        });
      }
    }

    return existingComment;
  }

  async delete(commentId: string, userId: string) {
    const existingComment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'post', 'post.course', 'post.course.users'],
    });
    if (!existingComment) throw HttpError.notFound('Comment not found');

    const foundUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'courses'],
    });
    if (!foundUser) throw HttpError.notFound('User not found');

    const isAuthor = existingComment.user.id === foundUser.id;
    const isAdmin = foundUser.role.name === 'admin';
    
    // Check if user is a teacher in the course where the comment was made
    const isTeacherInCourse = 
      foundUser.role.name === 'teacher' &&
      foundUser.courses.some((course) => course.id === existingComment.post.course.id);

    if (!isAuthor && !isAdmin && !isTeacherInCourse) {
      throw HttpError.forbidden(
        'You do not have permission to delete this comment.'
      );
    }

    await this.commentRepository.softDelete(existingComment);

    // Emit real-time event for WebSocket broadcast
    commentEventEmitter.emit('comment_deleted', {
      commentId,
      postId: existingComment.post.id,
      userIds: existingComment.post.course.users.map((u) => u.id),
    });

    return { message: 'Comment successfully deleted' };
  }
}
