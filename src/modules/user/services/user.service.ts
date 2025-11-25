import { HttpError } from '@common/libs/http-error';
import { AppDataSource } from '@database/db';
import { User, People, Role } from '@user/entities';
import { CreateUserDto, UpdateUserDto } from '@user/dtos';

console.log('UserService');
export class UserService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly peopleRepository = AppDataSource.getRepository(People);
  private readonly roleRepository = AppDataSource.getRepository(Role);
  async findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      relations: ['role', 'people'],
    });
  }

  async findByUserName(user_name: string) {
    return this.userRepository.findOne({ where: { user_name } });
  }

  async findPersonByDni(dni: string) {
    return this.peopleRepository.findOne({ where: { dni } });
  }

  async findRoleByName(role: string) {
    return this.roleRepository.findOne({ where: { name: role } });
  }

  async createUser(createUserDto: CreateUserDto, people: People, role: Role) {
    const user = this.userRepository.create({
      ...createUserDto,
      people,
      role,
      verified: false,
    });
    return this.userRepository.save(user);
  }

  async createPerson(data: Partial<People>) {
    const person = this.peopleRepository.create(data);
    return this.peopleRepository.save(person);
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['people', 'role'],
    });
    if (!user) throw new HttpError(404, 'Usuario no encontrado');

    if (updateUserDto.user_name) user.user_name = updateUserDto.user_name;
    if (updateUserDto.email) user.email = updateUserDto.email;
    if (updateUserDto.password) user.password = updateUserDto.password;
    if (updateUserDto.role) {
      const role = await this.roleRepository.findOne({
        where: { name: updateUserDto.role },
      });
      if (role) user.role = role;
    }

    if (user.people) {
      if (updateUserDto.first_name)
        user.people.first_name = updateUserDto.first_name;
      if (updateUserDto.last_name)
        user.people.last_name = updateUserDto.last_name;
      if (updateUserDto.phone_number)
        user.people.phone_number = updateUserDto.phone_number;
      if (updateUserDto.birth_date)
        user.people.birth_date = new Date(updateUserDto.birth_date);
      if (updateUserDto.institute)
        user.people.institute = updateUserDto.institute;
      if (updateUserDto.dni) user.people.dni = updateUserDto.dni;
      await this.peopleRepository.save(user.people);
    }

    return this.userRepository.save(user);
  }
}
