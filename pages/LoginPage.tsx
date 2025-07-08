import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { UserRole } from '../types';
import { useLocale } from '../LocaleContext';
import Card from '../components/Card';
import PohiSvgLogo from '../components/PohiSvgLogo';
import { UserCircleIcon, BuildingStorefrontIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { getTranslatedUserRole } from '../locales';

const LoginPage: React.FC = () => {
  const { login } = useAppContext();
  const navigate = useNavigate();
  const { t } = useLocale();

  const handleLogin = (role: UserRole) => {
    login(role);
    navigate('/');
  };

  const roles = [
    { role: UserRole.ADMIN, icon: <UserCircleIcon className="h-10 w-10 mb-3" /> },
    { role: UserRole.CUSTOMER, icon: <UserGroupIcon className="h-10 w-10 mb-3" /> },
    { role: UserRole.MANUFACTURER, icon: <BuildingStorefrontIcon className="h-10 w-10 mb-3" /> },
  ];

  return (
    <div className="min-h-screen bg-pohi-dark flex items-center justify-center p-4 video-bg-placeholder">
        <div className="w-full max-w-xl text-center">
            <div className="mb-8">
                <PohiSvgLogo className="h-24 w-24 mx-auto" />
                <h1 className="text-4xl font-bold mt-4">
                    <span className="text-cyan-400">P</span>
                    <span className="text-white">ohi AI </span>
                    <span className="text-cyan-400">Pro</span>
                </h1>
                <p className="text-slate-300 mt-2">{t('login_welcome')}</p>
            </div>
            
            <Card className="bg-slate-800/80 backdrop-blur-sm border border-slate-700">
                <h2 className="text-xl font-semibold text-white mb-6">{t('login_selectRole')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {roles.map(({ role, icon }) => (
                        <button
                            key={role}
                            onClick={() => handleLogin(role)}
                            className="flex flex-col items-center justify-center p-6 bg-slate-700/50 rounded-lg hover:bg-slate-700 hover-glow transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                        >
                            <span className="text-cyan-400">{icon}</span>
                            <span className="font-semibold text-white">{getTranslatedUserRole(role, t)}</span>
                        </button>
                    ))}
                </div>
            </Card>

            <footer className="mt-8">
                <p className="text-xs text-slate-500">{t('login_prototypeInfo')}</p>
            </footer>
        </div>
    </div>
  );
};

export default LoginPage;