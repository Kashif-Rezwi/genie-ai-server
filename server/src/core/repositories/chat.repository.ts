import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../../entities';
import { IChatRepository } from './interfaces/chat.repository.interface';

@Injectable()
export class ChatRepository implements IChatRepository {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>
  ) {}

  async findById(id: string): Promise<Chat | null> {
    return this.chatRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string, skip = 0, take = 100): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { userId },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(skip = 0, take = 100): Promise<Chat[]> {
    return this.chatRepository.find({
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async create(chatData: Partial<Chat>): Promise<Chat> {
    const chat = this.chatRepository.create(chatData);
    return this.chatRepository.save(chat);
  }

  async update(id: string, chatData: Partial<Chat>): Promise<Chat> {
    await this.chatRepository.update(id, chatData);
    const updatedChat = await this.findById(id);
    if (!updatedChat) {
      throw new Error(`Chat with ID ${id} not found after update`);
    }
    return updatedChat;
  }

  async delete(id: string): Promise<void> {
    await this.chatRepository.delete(id);
  }

  async findByIdWithMessages(id: string): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { id },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    });
  }

  async findRecentByUserId(userId: string, limit = 10): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { userId },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.chatRepository.count({ where: { userId } });
  }

  async findByTitleSearch(userId: string, searchTerm: string): Promise<Chat[]> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.userId = :userId', { userId })
      .andWhere('chat.title ILIKE :searchTerm', { searchTerm: `%${searchTerm}%` })
      .orderBy('chat.createdAt', 'DESC')
      .getMany();
  }
}
