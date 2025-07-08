// pages/MessagesPage.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocale } from '../LocaleContext'; // JAVÍTVA: ../LocaleContext
import { useAppContext } from '../App';
import PageTitle from '../components/PageTitle'; // JAVÍTVA: ../components/PageTitle
import Card from '../components/Card'; // JAVÍTVA: ../components/Card
import Button from '../components/Button'; // JAVÍTVA: ../components/Button
import Textarea from '../components/Textarea'; // JAVÍTVA: ../components/Textarea
import LoadingSpinner from '../components/LoadingSpinner'; // JAVÍTVA: ../components/LoadingSpinner
import AiFeatureButton from '../components/AiFeatureButton'; // JAVÍTVA: ../components/AiFeatureButton
import NewConversationModal from '../components/NewConversationModal'; // JAVÍTVA: ../components/NewConversationModal
import { Conversation, ChatMessage, MockCompany, UserRole } from '../types'; // JAVÍTVA: ../types
import { EnvelopeIcon, SparklesIcon, PaperAirplaneIcon, ChatBubbleBottomCenterTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CONVERSATIONS_STORAGE_KEY, MESSAGES_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY } from '../constants'; // JAVÍTVA: ../constants
import { ai } from '../lib/gemini'; // JAVÍTVA: ../lib/gemini
import { GenerateContentResponse } from '@google/genai';

export const MessagesPage: React.FC = () => {
    const { t, locale } = useLocale();
    const { userRole } = useAppContext();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
    const [allCompanies, setAllCompanies] = useState<MockCompany[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUser = useMemo(() => {
        if (userRole === UserRole.ADMIN) {
            return { id: 'ADMIN', name: t('messages_admin') };
        }
        // This is a simplified user identification for the prototype
        const companies: MockCompany[] = JSON.parse(localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY) || '[]');
        const userCompany = companies.find(c => c.role === userRole);
        return userCompany ? { id: userCompany.id, name: userCompany.companyName } : { id: userRole!, name: userRole! };
    }, [userRole, t]);
    
    useEffect(() => {
        try {
            const storedConvosRaw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
            const storedMessagesRaw = localStorage.getItem(MESSAGES_STORAGE_KEY);
            const storedCompaniesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);

            let allConvos: Conversation[] = storedConvosRaw ? JSON.parse(storedConvosRaw) : [];
            let allMessages: Record<string, ChatMessage[]> = storedMessagesRaw ? JSON.parse(storedMessagesRaw) : {};
            const allComps: MockCompany[] = storedCompaniesRaw ? JSON.parse(storedCompaniesRaw) : [];

            setAllCompanies(allComps);

            const userHasConvo = allConvos.some(c => c.participantIds.includes(currentUser.id));
            
            if (!userHasConvo && currentUser.id !== 'ADMIN') {
                const adminUser = { id: 'ADMIN', name: t('messages_admin') };
                const welcomeConvoId = `conv-${adminUser.id}-${currentUser.id}`;
                
                const newWelcomeConvo: Conversation = {
                    id: welcomeConvoId,
                    participantIds: [adminUser.id, currentUser.id],
                    participantNames: { [adminUser.id]: adminUser.name, [currentUser.id]: currentUser.name },
                    lastMessageText: t('messages_adminWelcomeBody'),
                    lastMessageTimestamp: new Date().toISOString(),
                    unreadCount: 1,
                };

                const newWelcomeMessage: ChatMessage = {
                    id: `msg-welcome-${Date.now()}`,
                    conversationId: welcomeConvoId,
                    senderId: adminUser.id,
                    senderName: adminUser.name,
                    text: t('messages_adminWelcomeBody'),
                    timestamp: new Date().toISOString(),
                    isRead: false,
                };

                allConvos.push(newWelcomeConvo);
                allMessages[welcomeConvoId] = [newWelcomeMessage];
                
                localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(allConvos));
                localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
            }

            setConversations(allConvos);
            setMessages(allMessages);
        } catch (e) {
            console.error(t('messages_load_error'), e);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser.id, currentUser.name, t]);
    
    const userConversations = useMemo(() => {
        return conversations
            .filter(c => c.participantIds.includes(currentUser.id))
            .sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    }, [conversations, currentUser.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeConversationId]);
    
    const handleStartConversation = (otherParticipant: MockCompany) => {
        const existingConvo = conversations.find(c => 
            c.participantIds.includes(currentUser.id) && c.participantIds.includes(otherParticipant.id)
        );

        if (existingConvo) {
            setActiveConversationId(existingConvo.id);
            setIsModalOpen(false);
            return;
        }

        const newConvoId = `conv-${currentUser.id}-${otherParticipant.id}`;
        const newConvo: Conversation = {
            id: newConvoId,
            participantIds: [currentUser.id, otherParticipant.id],
            participantNames: {
                [currentUser.id]: currentUser.name,
                [otherParticipant.id]: otherParticipant.companyName,
            },
            lastMessageText: '',
            lastMessageTimestamp: new Date().toISOString(),
            unreadCount: 0,
        };
        
        const updatedConversations = [...conversations, newConvo];
        const updatedMessages = {...messages, [newConvoId]: []};
        
        setConversations(updatedConversations);
        setMessages(updatedMessages);
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updatedConversations));
        localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updatedMessages));
        
        setActiveConversationId(newConvoId);
        setIsModalOpen(false);
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !activeConversationId) return;

        const message: ChatMessage = {
            id: `msg-${Date.now()}`,
            conversationId: activeConversationId,
            senderId: currentUser.id,
            senderName: currentUser.name,
            text: newMessage,
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        const updatedMessages = { ...messages, [activeConversationId]: [...(messages[activeConversationId] || []), message] };
        setMessages(updatedMessages);
        localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updatedMessages));

        const updatedConversations = conversations.map(c => 
            c.id === activeConversationId ? { ...c, lastMessageText: newMessage, lastMessageTimestamp: message.timestamp } : c
        );
        setConversations(updatedConversations);
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updatedConversations));

        setNewMessage('');
    };
    
    const handleAiAssist = async (assistType: 'improve' | 'suggest') => {
        if (!ai || (!newMessage.trim() && assistType === 'improve')) return;
        
        setIsAiLoading(true);
        const promptLang = locale === 'hu' ? 'Hungarian' : (locale === 'de' ? 'German' : 'English');
        let prompt = '';

        if (assistType === 'improve') {
            prompt = `You are a professional communication assistant. Rephrase the following text to be more clear, polite, and professional, while retaining its original meaning. Respond in ${promptLang}. Do not add any introductory text, just provide the improved version. Text to improve: "${newMessage}"`;
        } else { // suggest reply
            const lastMessage = activeConversationId ? messages[activeConversationId]?.slice(-1)[0]?.text : '';
            if (!lastMessage) {
                setIsAiLoading(false);
                return;
            }
            prompt = `You are an AI assistant in a chat on a timber marketplace. Based on the last message received, suggest a short, relevant, and professional reply in ${promptLang}. Last message: "${lastMessage}". Your suggested reply:`;
        }
        
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({model: "gemini-2.5-flash", contents: prompt});
            setNewMessage(response.text.trim());
        } catch(e) {
            console.error("AI Assist Error", e);
            setNewMessage(t('messages_ai_error'));
        } finally {
            setIsAiLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingSpinner text={t('messages_load_error')} />;
    }

    const activeConversation = activeConversationId ? conversations.find(c => c.id === activeConversationId) : null;
    const otherParticipantName = activeConversation ? Object.values(activeConversation.participantNames).find(name => name !== currentUser.name) : '';

    return (
        <>
            <PageTitle title={t('messages_title')} subtitle={t('messages_subtitle')} icon={<EnvelopeIcon className="h-8 w-8" />} />
            
            <NewConversationModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                allCompanies={allCompanies}
                currentUserId={currentUser.id}
                onStartConversation={handleStartConversation}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
                <Card className="md:col-span-1 lg:col-span-1 flex flex-col" bodyClassName="p-0 flex-grow flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                         <Button
                            onClick={() => setIsModalOpen(true)}
                            variant="secondary"
                            className="w-full"
                            leftIcon={<PlusIcon className="h-5 w-5"/>}
                         >
                             {t('messages_newMessageButton')}
                         </Button>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {userConversations.length > 0 ? (
                            <ul>
                               {userConversations.map(convo => {
                                        const otherName = Object.values(convo.participantNames).find(name => name !== currentUser.name);
                                        return (
                                        <li key={convo.id}>
                                            <button 
                                                onClick={() => setActiveConversationId(convo.id)}
                                                className={`w-full text-left p-4 border-b border-slate-700 hover:bg-slate-700/50 transition-colors duration-150 ${activeConversationId === convo.id ? 'bg-cyan-900/50' : ''}`}
                                            >
                                                <p className="font-semibold text-white">{otherName}</p>
                                                <p className="text-xs text-slate-300 truncate">{convo.lastMessageText}</p>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(convo.lastMessageTimestamp).toLocaleString(locale)}</p>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="p-4 text-center text-slate-400">{t('messages_noConversations')}</div>
                        )}
                    </div>
                </Card>

                <Card className="md:col-span-2 lg:col-span-3 flex flex-col h-full" bodyClassName="p-0 flex-grow flex flex-col">
                    {activeConversation ? (
                        <>
                           <div className="p-4 border-b border-slate-700">
                                <h3 className="text-lg font-semibold text-cyan-400">{otherParticipantName}</h3>
                           </div>
                           <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-4">
                               {messages[activeConversationId]?.map(msg => (
                                   <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                                       <div className={`max-w-[80%] py-2 px-3 rounded-lg text-sm shadow-md ${msg.senderId === currentUser.id ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-600 text-slate-100 rounded-bl-none'}`}>
                                           <p className="whitespace-pre-wrap">{msg.text}</p>
                                           <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'})}</p>
                                       </div>
                                   </div>
                               ))}
                               <div ref={messagesEndRef} />
                           </div>
                           <div className="p-4 border-t border-slate-700 bg-slate-800/50 mt-auto">
                                <div className="relative">
                                     <Textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder={t('messages_typeMessagePlaceholder')}
                                        rows={3}
                                        className="mb-0"
                                        textareaClassName="pr-28"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleSendMessage();
                                            }
                                        }}
                                    />
                                    <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                                         <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isAiLoading} size="sm" className="!p-2">
                                            <PaperAirplaneIcon className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-2">
                                    <AiFeatureButton 
                                        onClick={() => handleAiAssist('improve')} 
                                        isLoading={isAiLoading}
                                        disabled={!newMessage.trim()}
                                        text={t('messages_ai_improve')}
                                        leftIcon={<SparklesIcon className="h-4 w-4" />}
                                        size="sm"
                                        className="!w-auto"
                                    />
                                     <AiFeatureButton 
                                        onClick={() => handleAiAssist('suggest')} 
                                        isLoading={isAiLoading}
                                        text={t('messages_ai_suggestReply')}
                                        leftIcon={<ChatBubbleBottomCenterTextIcon className="h-4 w-4" />}
                                        size="sm"
                                        className="!w-auto"
                                    />
                                </div>
                           </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            {t('messages_selectConversation')}
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
};