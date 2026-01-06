import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Friendship } from '../entities';
import { FriendStatus } from '../common/enums';
import { AddFriendDto, AddFriendResponseDto } from './dto/add-friend.dto';
import {
  FriendshipItemDto,
  FriendProfileDto,
  PaginatedFriendResponseDto,
} from './dto/friend-list-response.dto';

/**
 * 친구 관리 서비스
 * 친구 목록 조회, 친구 추가, 친구 삭제 기능 제공
 */
@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
  ) {}

  /**
   * 친구 목록 조회
   * @param userId 사용자 ID
   * @param limit 페이지당 아이템 수
   * @param offset 건너뛸 아이템 수
   * @returns 친구 목록 (페이지네이션)
   */
  async getFriends(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedFriendResponseDto> {
    // userId가 포함된 Friendship 양방향 조회
    const [friendships, total] = await this.friendshipRepository
      .createQueryBuilder('friendship')
      .leftJoinAndSelect('friendship.user', 'user')
      .leftJoinAndSelect('friendship.friend', 'friend')
      .where(
        '(friendship.userId = :userId OR friendship.friendId = :userId) AND friendship.status = :status',
        { userId, status: FriendStatus.CONNECTED },
      )
      .orderBy('friendship.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    // 상대방 정보 매핑
    const friendshipItems = friendships.map((friendship) => {
      // userId가 user_id면 friend가 상대방, 아니면 user가 상대방
      const friendProfile =
        friendship.userId === userId ? friendship.friend : friendship.user;

      return new FriendshipItemDto({
        id: friendship.id,
        status: friendship.status,
        friend: new FriendProfileDto({
          id: friendProfile.id,
          nickname: friendProfile.nickname,
          profileImg: friendProfile.profileImg,
        }),
        createdAt: friendship.createdAt,
      });
    });

    return new PaginatedFriendResponseDto(
      friendshipItems,
      total,
      limit,
      offset,
    );
  }

  /**
   * 친구 추가
   * @param userId 사용자 ID
   * @param dto 친구 추가 요청 데이터
   * @returns 친구 추가 응답
   */
  async addFriend(
    userId: string,
    dto: AddFriendDto,
  ): Promise<AddFriendResponseDto> {
    // 1. 전화번호로 대상 사용자 조회
    const targetUser = await this.userRepository.findOne({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!targetUser) {
      throw new NotFoundException('해당 전화번호의 사용자를 찾을 수 없습니다.');
    }

    // 2. 자기 자신 체크
    if (targetUser.id === userId) {
      throw new BadRequestException('자기 자신을 친구로 추가할 수 없습니다.');
    }

    // 3. user_id < friend_id 정렬
    const smallerId = userId < targetUser.id ? userId : targetUser.id;
    const largerId = userId < targetUser.id ? targetUser.id : userId;

    // 4. 중복 관계 체크
    const existingFriendship = await this.friendshipRepository.findOne({
      where: {
        userId: smallerId,
        friendId: largerId,
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.CONNECTED) {
        throw new ConflictException('이미 친구 관계입니다.');
      } else if (existingFriendship.status === FriendStatus.BLOCKED) {
        throw new ConflictException('차단된 사용자입니다.');
      }
    }

    // 5. Friendship 생성 (자동 승인)
    const friendship = this.friendshipRepository.create({
      userId: smallerId,
      friendId: largerId,
      status: FriendStatus.CONNECTED,
    });

    await this.friendshipRepository.save(friendship);

    return new AddFriendResponseDto('친구가 추가되었습니다.', friendship.id);
  }

  /**
   * 친구 삭제
   * @param userId 사용자 ID
   * @param friendshipId 친구 관계 ID
   */
  async removeFriend(userId: string, friendshipId: string): Promise<void> {
    // 1. Friendship 조회
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('친구 관계를 찾을 수 없습니다.');
    }

    // 2. userId 권한 확인 (userId가 포함되어 있는지)
    if (friendship.userId !== userId && friendship.friendId !== userId) {
      throw new ForbiddenException('이 친구 관계를 삭제할 권한이 없습니다.');
    }

    // 3. 삭제
    await this.friendshipRepository.remove(friendship);
  }
}
