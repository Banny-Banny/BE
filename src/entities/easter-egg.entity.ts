import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Capsule } from './capsule.entity';

@Entity('easter_eggs')
export class EasterEgg {
  @PrimaryColumn('uuid', { name: 'capsule_id' })
  capsuleId: string;

  @Column({
    type: 'int',
    default: 0,
    name: 'view_limit',
    comment: '선착순 인원 제한 (0이면 무제한)',
  })
  viewLimit: number;

  @Column({
    type: 'int',
    default: 0,
    name: 'view_count',
    comment: '현재까지 열람한 인원 수. view_limit 도달 시 마감',
  })
  viewCount: number;

  @OneToOne(() => Capsule, (capsule) => capsule.easterEgg, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;
}
