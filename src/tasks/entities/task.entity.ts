import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RoleName } from '../../roles/role-name.enum';
import { User } from '../../users/entities/user.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'varchar', length: 30, default: RoleName.User })
  requiredRole: RoleName;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.tasks, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
