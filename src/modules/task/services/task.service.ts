import { AppDataSource } from '@database/db';
import { HttpError } from '@common/libs/http-error';
import { FileProps } from '@common/interfaces/file-props';
import { TaskStatus } from '@common/enums/task-status.enum';

import { Course } from '@course/entities/course.entity';
import { User } from '@user/entities';
import { Task, TaskFile } from '@task/entities';

import {
  CreateTaskDto,
  UpdateTaskDto,
} from '@task/dtos';

import { taskEventEmitter } from '@common/events/task.events';

export class TaskService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly courseRepository = AppDataSource.getRepository(Course);
  private readonly taskRepository = AppDataSource.getRepository(Task);
  private readonly fileTaskRepository = AppDataSource.getRepository(TaskFile);
  private dataSource = AppDataSource.getDataSource();

  async create(
    courseId: string,
    userId: string,
    createTaskDto: CreateTaskDto,
    fileProps?: FileProps
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const foundUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role', 'courses'],
      });

      if (!foundUser) throw HttpError.notFound('User not found');

      const courseData = await this.courseRepository.findOne({
        where: { id: courseId },
        relations: ['users'],
      });
      if (!courseData) throw HttpError.notFound('Course not found');

      const isInCourse = courseData.users.some((u) => u.id === userId);
      if (!isInCourse)
        throw HttpError.forbidden('The user does not belong to the class');

      const newTask = this.taskRepository.create({
        title: createTaskDto.title,
        description: createTaskDto.description,
        due_date: createTaskDto.due_date,
        course: courseData,
      });
      await queryRunner.manager.save(newTask);

      if (fileProps) {
        const { fileUrl, fileId, fileType } = fileProps;
        const newFileTask = this.fileTaskRepository.create({
          file_type: fileType,
          file_id: fileId,
          file_url: fileUrl,
          task: newTask,
        });
        await queryRunner.manager.save(newFileTask);
      }

      await queryRunner.commitTransaction();

      // Emit domain event - handler will create notifications
      taskEventEmitter.emit('task_created', {
        task: {
          id: newTask.id,
          title: newTask.title,
          description: newTask.description,
          due_date: newTask.due_date,
          courseId: courseData.id,
          courseName: courseData.name,
          createdAt: newTask.created_at,
        },
        userIds: courseData.users.map((u) => u.id),
        authorId: userId,
      });

      return newTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    courseId: string,
    userId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
    fileProps?: FileProps
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const foundUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!foundUser) throw HttpError.notFound('User not found');

      const course = await this.courseRepository.findOne({
        where: { id: courseId },
        relations: ['users'],
      });
      if (!course) throw HttpError.notFound('Course not found');

      const task = await this.taskRepository.findOne({
        where: { id: taskId, course: { id: courseId } },
        relations: ['course'],
      });
      if (!task) {
        throw HttpError.notFound('Task not found in this course');
      }

      if (updateTaskDto.title) task.title = updateTaskDto.title;
      if (updateTaskDto.description)
        task.description = updateTaskDto.description;
      if (updateTaskDto.due_date)
        task.due_date = new Date(updateTaskDto.due_date);

      await queryRunner.manager.save(task);

      if (fileProps) {
        const { fileUrl, fileId, fileType } = fileProps;
        let fileTask = await this.fileTaskRepository.findOne({
          where: { task: { id: taskId } },
        });
        if (fileTask) {
          fileTask.file_url = fileUrl;
          fileTask.file_id = fileId;
          fileTask.file_type = fileType;
          await queryRunner.manager.save(fileTask);
        } else {
          fileTask = this.fileTaskRepository.create({
            file_url: fileUrl,
            file_id: fileId,
            file_type: fileType,
            task: task,
          });
          await queryRunner.manager.save(fileTask);
        }
      }

      await queryRunner.commitTransaction();

      // Emit real-time event for WebSocket broadcast
      const updatedTask = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['course', 'course.users'],
      });

      if (updatedTask) {
        taskEventEmitter.emit('task_updated', {
          task: {
            id: updatedTask.id,
            title: updatedTask.title,
            description: updatedTask.description,
            due_date: updatedTask.due_date,
            courseId: updatedTask.course.id,
            courseName: updatedTask.course.name,
            updatedAt: updatedTask.updated_at,
          },
          userIds: updatedTask.course.users.map((u) => u.id),
        });
      }

      return { message: 'Task updated successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(courseId: string, taskId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const foundUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!foundUser) throw HttpError.notFound('User not found');

      const course = await this.courseRepository.findOne({
        where: { id: courseId },
        relations: ['users'],
      });
      if (!course) throw HttpError.notFound('Course not found');

      const task = await this.taskRepository.findOne({
        where: { id: taskId, course: { id: courseId } },
        relations: ['taskFiles'],
      });
      if (!task) {
        throw HttpError.notFound('Task not found in this course');
      }

      let public_id = null;

      if (task.taskFiles && task.taskFiles.length > 0) {
        public_id = task.taskFiles[0].file_id;
      }

      await queryRunner.manager.remove(task);
      await queryRunner.commitTransaction();

      // Emit real-time event for WebSocket broadcast
      taskEventEmitter.emit('task_deleted', {
        taskId,
        courseId,
        userIds: course.users.map((u) => u.id),
      });

      return public_id;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  async getAllByCourse(courseId: string, userId: string, page: number = 1, limit: number = 10) {
    const foundUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses'],
    });
    if (!foundUser) throw HttpError.notFound('User not found');

    const courseData = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: ['users'],
    });
    if (!courseData) throw HttpError.notFound('Course not found');

    const isInCourse = courseData.users.some((u) => u.id === userId);
    if (!isInCourse)
      throw HttpError.forbidden('The user does not belong to the class');

    const skip = (page - 1) * limit;

    const [tasks, total] = await this.taskRepository.findAndCount({
      where: { course: { id: courseId } },
      relations: ['taskFiles'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return Object.assign(tasks, {
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

  async getOne(taskId: string, userId: string) {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['course'],
    });
    if (!task) throw HttpError.notFound('Task not found');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses'],
    });
    if (!user) throw HttpError.notFound('User not found');

    const isInCourse = user.courses.some((c) => c.id === task.course.id);
    if (!isInCourse)
      throw HttpError.forbidden('The user does not belong to the class');

    return task;
  }
}

