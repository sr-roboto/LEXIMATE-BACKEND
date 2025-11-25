import { Not, IsNull } from 'typeorm';
import { AppDataSource } from '@database/db';
import { User, People, Permission, Role, UserFile } from '@user/entities';
import { BcryptAdapter } from '@common/adapters/hash.adapter';

import { Course } from '@course/entities/course.entity';
import { Post } from '@post/entities/post.entity';
import { Task,TaskFile } from '@task/entities';
import { Comment } from '@comment/entities/comment.entity';
import { Chat, Message } from '@chat/entities';
import { Notification } from '@notification/entities';
import { NotificationEnum } from '@common/enums/notification.enum';

export class SeedService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly roleRepository = AppDataSource.getRepository(Role);
  private readonly peopleRepository = AppDataSource.getRepository(People);
  private readonly permissionRepository =
    AppDataSource.getRepository(Permission);
  private readonly courseRepository = AppDataSource.getRepository(Course);
  private readonly postRepository = AppDataSource.getRepository(Post);
  private readonly commentRepository = AppDataSource.getRepository(Comment);
  private readonly taskRepository = AppDataSource.getRepository(Task);
  private readonly fileUserRepository = AppDataSource.getRepository(UserFile);
  private readonly fileTaskRepository = AppDataSource.getRepository(TaskFile);
  private readonly bcryptAdapter = new BcryptAdapter();
  private dataSource = AppDataSource.getDataSource();

  private readonly chatRepository = AppDataSource.getRepository(Chat);
  private readonly messageRepository = AppDataSource.getRepository(Message);
  private readonly notificationRepository = AppDataSource.getRepository(Notification);

  async seedAll() {
    // Clean up database
    await this.dataSource.query('DELETE FROM "user_courses_course"');
    await this.dataSource.query('DELETE FROM "role_permissions_permission"');
    await this.dataSource.query('DELETE FROM "chat_users_user"');

    await this.notificationRepository.delete({ id: Not(IsNull()) });
    await this.messageRepository.delete({ id: Not(IsNull()) });
    await this.chatRepository.delete({ id: Not(IsNull()) });
    await this.fileTaskRepository.delete({ id: Not(IsNull()) });
    await this.fileUserRepository.delete({ id: Not(IsNull()) });
    await this.commentRepository.delete({ id: Not(IsNull()) });
    await this.postRepository.delete({ id: Not(IsNull()) });
    await this.taskRepository.delete({ id: Not(IsNull()) });
    await this.courseRepository.delete({ id: Not(IsNull()) });
    await this.userRepository.delete({ id: Not(IsNull()) });
    await this.peopleRepository.delete({ id: Not(IsNull()) });
    await this.roleRepository.delete({ id: Not(IsNull()) });
    await this.permissionRepository.delete({ id: Not(IsNull()) });

    const permissionsData = [
      { name: 'manage_users', description: 'Gestionar usuarios' },
      { name: 'manage_courses', description: 'Gestionar cursos' },
      { name: 'manage_posts', description: 'Gestionar posts' },
      { name: 'manage_comments', description: 'Gestionar comentarios' },
      { name: 'view_content', description: 'Ver contenido' },
    ];
    const permissions: Permission[] = [];
    for (const perm of permissionsData) {
      let permission = await this.permissionRepository.findOne({
        where: { name: perm.name },
      });
      if (!permission) {
        permission = this.permissionRepository.create(perm);
        await this.permissionRepository.save(permission);
      }
      permissions.push(permission);
    }

    const rolesData = [
      { name: 'admin', description: 'Administrador', permissions },
      {
        name: 'teacher',
        description: 'Profesor',
        permissions: permissions.filter((p) => p.name !== 'manage_users'),
      },
      {
        name: 'student',
        description: 'Estudiante',
        permissions: permissions.filter((p) => p.name === 'view_content'),
      },
      {
        name: 'guest',
        description: 'Invitado',
        permissions: permissions.filter((p) => p.name === 'view_content'),
      },
    ];
    const roles: Role[] = [];
    for (const roleData of rolesData) {
      let role = await this.roleRepository.findOne({
        where: { name: roleData.name },
        relations: ['permissions'],
      });
      if (!role) {
        role = this.roleRepository.create({
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
        });
        await this.roleRepository.save(role);
      }
      roles.push(role);
    }

    const usersData = [
      {
        user_name: 'admin',
        email: 'admin@example.com',
        password: await this.bcryptAdapter.hash('Admin_123'),
        first_name: 'Admin',
        last_name: 'User',
        dni: '10000001',
        institute: 'Main',
        phone_number: '1111111111',
        birth_date: new Date('1990-01-01'),
        role: roles.find((r) => r.name === 'admin'),
      },
      {
        user_name: 'teacher',
        email: 'teacher@example.com',
        password: await this.bcryptAdapter.hash('Teacher_123'),
        first_name: 'Teacher',
        last_name: 'User',
        dni: '10000002',
        institute: 'Main',
        phone_number: '2222222222',
        birth_date: new Date('1991-01-01'),
        role: roles.find((r) => r.name === 'teacher'),
      },
      {
        user_name: 'student',
        email: 'student@example.com',
        password: await this.bcryptAdapter.hash('Student_123'),
        first_name: 'Student',
        last_name: 'User',
        dni: '10000003',
        institute: 'Main',
        phone_number: '3333333333',
        birth_date: new Date('1992-01-01'),
        role: roles.find((r) => r.name === 'student'),
      },
      {
        user_name: 'guest',
        email: 'guest@example.com',
        password: await this.bcryptAdapter.hash('Guest_123'),
        first_name: 'Guest',
        last_name: 'User',
        dni: '10000004',
        institute: 'Main',
        phone_number: '4444444444',
        birth_date: new Date('1993-01-01'),
        role: roles.find((r) => r.name === 'guest'),
      },
    ];

    const createdUsers: User[] = [];

    for (const userData of usersData) {
      let person = await this.peopleRepository.findOne({
        where: { dni: userData.dni },
      });
      if (!person) {
        person = this.peopleRepository.create({
          first_name: userData.first_name,
          last_name: userData.last_name,
          dni: userData.dni,
          institute: userData.institute,
          phone_number: userData.phone_number,
          birth_date: userData.birth_date,
        });
        await this.peopleRepository.save(person);
      }

      let user = await this.userRepository.findOne({
        where: { email: userData.email },
      });
      if (!user) {
        user = this.userRepository.create({
          user_name: userData.user_name,
          email: userData.email,
          password: userData.password,
          verified: true,
          people: person,
          role: userData.role,
        });
        await this.userRepository.save(user);
      }
      createdUsers.push(user);

      
      const userFile = this.fileUserRepository.create({
        file_id: `profile_${user.user_name}`,
        file_url: `https://api.dicebear.com/9.x/notionists/svg?seed=${user.id}&gestureProbability=50&beardProbability=30`,
        file_type: 'image/svg+xml',
        user: user,
      });
      await this.fileUserRepository.save(userFile);
    }

    const teacher = createdUsers.find(u => u.user_name === 'teacher');
    const student = createdUsers.find(u => u.user_name === 'student');

    if (teacher && student) {
      
      const coursesData = [
        { name: 'Matemáticas Avanzadas', description: 'Curso de cálculo y álgebra', class_code: 'MATH101' },
        { name: 'Historia Universal', description: 'Historia del mundo desde 1900', class_code: 'HIST202' },
        { name: 'Física Cuántica', description: 'Introducción a la mecánica cuántica', class_code: 'PHYS303' },
        { name: 'Literatura Clásica', description: 'Análisis de obras maestras', class_code: 'LIT404' },
      ];

      for (const courseData of coursesData) {
        const course = this.courseRepository.create({
          name: courseData.name,
          description: courseData.description,
          class_code: courseData.class_code,
          users: [teacher, student], // Teacher and Student are in the course
        });
        await this.courseRepository.save(course);

        const postsData = [
          {
            title: `Bienvenida a ${course.name}`,
            content: 'Bienvenidos a este nuevo ciclo escolar. Espero que aprendan mucho.',
          },
          {
            title: `Material de estudio - ${course.name}`,
            content: 'Recuerden revisar el sílabo y los materiales adjuntos en la sección de archivos.',
          }
        ];

        for (const postData of postsData) {
          const post = this.postRepository.create({
            title: postData.title,
            content: postData.content,
            course: course,
            user: teacher,
          });
          await this.postRepository.save(post);

          const comment = this.commentRepository.create({
            content: '¡Gracias profesor! Estoy emocionado por comenzar.',
            post: post,
            user: student,
          });
          await this.commentRepository.save(comment);
        }

        const task = this.taskRepository.create({
          title: 'Tarea 1: Investigación',
          description: 'Investigar sobre el tema introductorio.',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
          course: course,
        });
        await this.taskRepository.save(task);

        const taskFile = this.fileTaskRepository.create({
          file_id: `task_${task.id}_file`,
          file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          file_type: 'application/pdf',
          task: task,
        });
        await this.fileTaskRepository.save(taskFile);
      }

      const chat = this.chatRepository.create({
        users: [teacher, student],
      });
      await this.chatRepository.save(chat);

      const messagesData = [
        { content: 'Hola profesor, tengo una duda sobre la tarea.', sender: student },
        { content: 'Hola, dime, ¿en qué puedo ayudarte?', sender: teacher },
      ];

      for (const msgData of messagesData) {
        const message = this.messageRepository.create({
          content: msgData.content,
          sender: msgData.sender,
          chat: chat,
        });
        await this.messageRepository.save(message);
      }

      // 12. Notifications
      // 12. Notifications
      // Fetch real entities to get IDs
      const mathCourse = await this.courseRepository.findOne({ where: { name: 'Matemáticas Avanzadas' } });
      const historyCourse = await this.courseRepository.findOne({ where: { name: 'Historia Universal' } });
      
      if (mathCourse && historyCourse) {
        const mathTask = await this.taskRepository.findOne({ where: { course: { id: mathCourse.id }, title: 'Tarea 1: Investigación' } });
        const mathPost = await this.postRepository.findOne({ where: { course: { id: mathCourse.id }, title: 'Bienvenida a Matemáticas Avanzadas' } });
        const historyPost = await this.postRepository.findOne({ where: { course: { id: historyCourse.id }, title: 'Material de estudio - Historia Universal' } });

        const notificationsData = [];

        if (mathTask) {
          notificationsData.push({
            userId: student.id,
            type: NotificationEnum.TASK_ASSIGNED,
            title: 'Nueva tarea asignada',
            message: 'Se ha asignado una nueva tarea: Tarea 1: Investigación',
            data: { 
              url: `/courses/${mathCourse.id}/task/${mathTask.id}`, 
              taskId: mathTask.id, 
              courseId: mathCourse.id, 
              courseName: mathCourse.name 
            },
          });
        }

        if (mathPost) {
          notificationsData.push({
            userId: teacher.id,
            type: NotificationEnum.COMMENT_ADDED,
            title: 'Nuevo comentario en tu post',
            message: 'student comentó en tu post: "Bienvenida a Matemáticas Avanzadas"',
            data: { 
              url: `/courses/${mathCourse.id}/post/${mathPost.id}`, 
              postId: mathPost.id, 
              courseId: mathCourse.id, 
              commenterName: 'student' 
            },
          });
        }

        if (historyPost) {
          notificationsData.push({
            userId: student.id,
            type: NotificationEnum.POST_CREATED,
            title: 'Nuevo post en el curso',
            message: 'teacher publicó: "Material de estudio - Historia Universal" en Historia Universal',
            data: { 
              url: `/courses/${historyCourse.id}/post/${historyPost.id}`, 
              postId: historyPost.id, 
              courseId: historyCourse.id, 
              courseName: historyCourse.name 
            },
            read: true,
          });
        }

        for (const notifData of notificationsData) {
          const notification = this.notificationRepository.create(notifData);
          await this.notificationRepository.save(notification);
        }
      }
    }

    return { message: 'Seed completed successfully' };
  }
}
