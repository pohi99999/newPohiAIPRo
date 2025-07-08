import React, { useState, useMemo } from 'react';
import { MockCompany, UserRole } from '../types';
import { useLocale } from '../LocaleContext';
import Card from './Card';
import Input from './Input';
import Button from './Button';
import { UserCircleIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCompanies: MockCompany[];
  currentUserId: string;
  onStartConversation: (company: MockCompany) => void;
}

const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  allCompanies,
  currentUserId,
  onStartConversation,
}) => {
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState('');

  const availableUsers = useMemo(() => {
    return allCompanies
      .filter(c => c.id !== currentUserId)
      .filter(c => c.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allCompanies, currentUserId, searchTerm]);

  if (!isOpen) {
    return null;
  }

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={handleModalContentClick}
      >
        <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-cyan-400">{t('messages_startConversationWith')}</h3>
        </div>
          <div className="p-4 border-b border-slate-700">
            <Input 
              placeholder={t('search') + '...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="mb-0"
              aria-label={t('search')}
            />
          </div>
          <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
            {availableUsers.length > 0 ? (
                <ul className="space-y-1">
                {availableUsers.map(company => (
                    <li key={company.id}>
                    <button 
                        onClick={() => onStartConversation(company)}
                        className="w-full flex items-center p-3 rounded-md hover:bg-slate-700 transition-colors"
                    >
                        <div className="mr-4 text-cyan-400 shrink-0">
                        {company.role === UserRole.CUSTOMER ? <UserCircleIcon className="h-8 w-8"/> : <BuildingStorefrontIcon className="h-8 w-8"/>}
                        </div>
                        <div className="text-left overflow-hidden">
                        <p className="font-semibold text-white truncate">{company.companyName}</p>
                        <p className="text-xs text-slate-400 truncate">{company.address?.city}, {company.address?.country}</p>
                        </div>
                    </button>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-center text-slate-400 py-8">{t('messages_noUsersFound')}</p>
            )}
          </div>
          <div className="p-4 border-t border-slate-700 flex justify-end">
            <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          </div>
      </div>
    </div>
  );
};

export default NewConversationModal;