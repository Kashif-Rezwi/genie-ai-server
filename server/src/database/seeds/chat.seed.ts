import { DataSource } from 'typeorm';
import { Chat, Message, MessageRole, User } from '../../entities';

export const seedSampleChats = async (dataSource: DataSource) => {
    const userRepo = dataSource.getRepository(User);
    const chatRepo = dataSource.getRepository(Chat);
    const messageRepo = dataSource.getRepository(Message);

    // Find admin user
    const adminUser = await userRepo.findOne({ where: { email: 'admin@genie.com' } });

    if (!adminUser) {
        console.log('⚠️ Admin user not found, skipping chat seed');
        return;
    }

    // Check if sample chat already exists
    const existingChat = await chatRepo.findOne({ where: { userId: adminUser.id } });

    if (existingChat) {
        console.log('⚠️ Sample chat already exists');
        return;
    }

    // Create sample chat
    const sampleChat = chatRepo.create({
        title: 'Welcome to Genie AI',
        systemPrompt:
            'You are a helpful AI assistant. Be friendly and provide accurate information.',
        userId: adminUser.id,
    });

    const savedChat = await chatRepo.save(sampleChat);

    // Add sample messages
    const sampleMessages = [
        {
            role: MessageRole.SYSTEM,
            content:
                'You are a helpful AI assistant. Be friendly and provide accurate information.',
            creditsUsed: 0,
        },
        {
            role: MessageRole.USER,
            content: 'Hello! Can you help me understand how this AI chat system works?',
            creditsUsed: 0,
        },
        {
            role: MessageRole.ASSISTANT,
            content:
                "Hello! I'd be happy to help you understand this AI chat system. This is Genie AI, a multi-model AI platform that allows you to interact with different AI models through a credit-based system. You can create multiple chat sessions, each with its own context and system prompts. The system supports both quick responses and streaming for a real-time chat experience. Would you like to know more about any specific features?",
            model: 'claude-3-haiku-20240307',
            creditsUsed: 0,
        },
    ];

    for (const messageData of sampleMessages) {
        const message = messageRepo.create({
            ...messageData,
            chatId: savedChat.id,
        });
        await messageRepo.save(message);
    }

    console.log('✅ Sample chat seeded successfully');
};
