import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageRole } from '../../entities';
import { IMessageRepository } from './interfaces/message.repository.interface';

@Injectable()
export class MessageRepository implements IMessageRepository {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>
  ) {}

  async findById(id: string): Promise<Message | null> {
    return this.messageRepository.findOne({ where: { id } });
  }

  async findByChatId(chatId: string, skip = 0, take = 100): Promise<Message[]> {
    return this.messageRepository.find({
      where: { chatId },
      skip,
      take,
      order: { createdAt: 'ASC' },
    });
  }

  async findAll(skip = 0, take = 100): Promise<Message[]> {
    return this.messageRepository.find({
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async create(messageData: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create(messageData);
    return this.messageRepository.save(message);
  }

  async update(id: string, messageData: Partial<Message>): Promise<Message> {
    await this.messageRepository.update(id, messageData);
    const updatedMessage = await this.findById(id);
    if (!updatedMessage) {
      throw new Error(`Message with ID ${id} not found after update`);
    }
    return updatedMessage;
  }

  async delete(id: string): Promise<void> {
    await this.messageRepository.delete(id);
  }

  async findRecentByChatId(chatId: string, limit = 50): Promise<Message[]> {
    return this.messageRepository.find({
      where: { chatId },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findByRole(chatId: string, role: MessageRole): Promise<Message[]> {
    return this.messageRepository.find({
      where: { chatId, role },
      order: { createdAt: 'ASC' },
    });
  }

  async countByChatId(chatId: string): Promise<number> {
    return this.messageRepository.count({ where: { chatId } });
  }

  async findByCreditsUsedAbove(threshold: number): Promise<Message[]> {
    return this.messageRepository
      .createQueryBuilder('message')
      .where('message.creditsUsed > :threshold', { threshold })
      .orderBy('message.createdAt', 'DESC')
      .getMany();
  }

  async getTotalCreditsUsedByChat(chatId: string): Promise<number> {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select('SUM(message.creditsUsed)', 'total')
      .where('message.chatId = :chatId', { chatId })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.chat', 'chat')
      .where('chat.userId = :userId', { userId })
      .getCount();
  }

  async getTotalCreditsUsedByUserId(userId: string): Promise<number> {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.chat', 'chat')
      .select('SUM(message.creditsUsed)', 'total')
      .where('chat.userId = :userId', { userId })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }
}
