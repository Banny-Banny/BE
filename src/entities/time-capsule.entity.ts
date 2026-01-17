import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { RoomStatus } from '../common/enums';
import { Capsule } from './capsule.entity';
import { Order } from './order.entity';

@Entity('time_capsules')
export class TimeCapsule {
  @PrimaryColumn('uuid', { name: 'capsule_id' })
  capsuleId: string;

  @Column({
    type: 'uuid',
    name: 'order_id',
    unique: true,
    comment: '결제 주문 연계 (주문당 1캡슐)',
  })
  orderId: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'open_at',
    comment: '개봉 예정일. 이 시간이 지나야 is_locked 해제 가능',
  })
  openAt: Date | null;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_locked',
    comment: 'App 표시용 플래그. open_at 비교 후 서버에서 업데이트',
  })
  isLocked: boolean;

  @Column({
    type: 'varchar',
    length: 6,
    unique: true,
    nullable: true,
    name: 'invite_code',
    comment: '대기실 초대 코드 (결제 완료 후 생성)',
  })
  inviteCode: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '대기실 마감시한 (결제 완료 + 24시간)',
  })
  deadline: Date | null;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    enumName: 'time_capsules_room_status_enum',
    nullable: true,
    name: 'room_status',
    comment: '대기실 상태 (nullable: 대기실 없음)',
  })
  roomStatus: RoomStatus | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'buried_at',
    comment: '캡슐이 매장된 시각',
  })
  buriedAt: Date | null;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_auto_submitted',
    comment: '자동 제출 여부',
  })
  isAutoSubmitted: boolean;

  @OneToOne(() => Capsule, (capsule) => capsule.timeCapsule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;

  @OneToOne(() => Order, (order) => order.timeCapsule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
