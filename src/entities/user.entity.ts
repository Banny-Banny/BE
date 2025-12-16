import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Capsule } from './capsule.entity';
import { Order } from './order.entity';
import { Friendship } from './friendship.entity';
import { CapsuleAccessLog } from './capsule-access-log.entity';
import { CustomerService } from './customer-service.entity';

/**
 * 사용자 기본 정보
 * 친구 연동을 위해 전화번호가 핵심 키 역할을 함
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid', {
    comment: '외부 유출 방지를 위한 랜덤 고유 ID',
  })
  id: string;

  @Column({ type: 'varchar', length: 50, comment: '앱 내 표시되는 이름' })
  nickname: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
    name: 'phone_number',
    comment: '친구 추천 및 중복 가입 방지',
  })
  phoneNumber: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '계정 복구 및 알림용',
  })
  email: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'profile_img',
    comment: 'S3 이미지 URL',
  })
  profileImg: string;

  // [핵심] 카카오 고유 ID (Long 타입이므로 String으로 저장)
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'kakao_id',
    unique: true,
    comment: '카카오 소셜로그인 ID',
  })
  kakaoId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'LOCAL',
    comment: 'KAKAO, GOOGLE, APPLE, LOCAL 등 인증 제공자 구분',
  })
  provider: string;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_marketing_agreed',
    comment: '마케팅 정보 수신 동의',
  })
  isMarketingAgreed: boolean;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_push_agreed',
    comment: '앱 푸시 알림 수신 동의',
  })
  isPushAgreed: boolean;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_location_term_agreed',
    comment: '위치기반 서비스 이용약관 동의',
  })
  isLocationTermAgreed: boolean;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
    comment: 'True: 활동중, False: 탈퇴/정지',
  })
  isActive: boolean;

  @Column({
    type: 'int',
    default: 3,
    name: 'egg_slots',
    comment:
      '사용자가 보유한 이스터에그 작성 가능 슬롯 (기본 3, 생성 시 1 소모). view_limit 소진 시 1개 회복.',
  })
  eggSlots: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    nullable: true,
    comment: 'Soft Delete',
  })
  deletedAt: Date;

  // Relations
  @OneToMany(() => Capsule, (capsule) => capsule.user)
  capsules: Capsule[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Friendship, (friendship) => friendship.user)
  friendships: Friendship[];

  @OneToMany(() => Friendship, (friendship) => friendship.friend)
  friendOf: Friendship[];

  @OneToMany(() => CapsuleAccessLog, (log) => log.viewer)
  accessLogs: CapsuleAccessLog[];

  @OneToMany(() => CustomerService, (cs) => cs.user)
  customerServices: CustomerService[];
}
