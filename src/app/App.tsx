import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router';
import { Layout } from './Layout';
import { TodayPage } from '../pages/Today';
import { Placeholder } from '../pages/Placeholder';

const LearnPage = lazy(() => import('../pages/Learn').then((m) => ({ default: m.LearnPage })));
const CardsPage = lazy(() => import('../pages/Cards').then((m) => ({ default: m.CardsPage })));
const CalcPage = lazy(() => import('../pages/Calc').then((m) => ({ default: m.CalcPage })));
const CalcTrainerPage = lazy(() => import('../pages/CalcTrainer').then((m) => ({ default: m.CalcTrainerPage })));
const AiPage = lazy(() => import('../pages/Ai').then((m) => ({ default: m.AiPage })));
const AiGradePage = lazy(() => import('../pages/AiGrade').then((m) => ({ default: m.AiGradePage })));
const AiGeneratePage = lazy(() => import('../pages/AiGenerate').then((m) => ({ default: m.AiGeneratePage })));
const AiExamPage = lazy(() => import('../pages/AiExam').then((m) => ({ default: m.AiExamPage })));
const AiCoachPage = lazy(() => import('../pages/AiCoach').then((m) => ({ default: m.AiCoachPage })));
const SettingsPage = lazy(() => import('../pages/Settings').then((m) => ({ default: m.SettingsPage })));

/** Neue Sitzung bei jeder neuen Filter-URL (sonst bliebe die alte Warteschlange stehen) */
function LearnRoute() {
  const { search } = useLocation();
  return <LearnPage key={search} />;
}

const Loading = () => <div className="p-8 text-center text-slate-500">Lade …</div>;

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="karten" element={<CardsPage />} />
            <Route path="lernen" element={<LearnRoute />} />
            <Route path="rechnen" element={<CalcPage />} />
            <Route path="rechnen/:id" element={<CalcTrainerPage />} />
            <Route path="ki" element={<AiPage />} />
            <Route path="ki/bewerten" element={<AiGradePage />} />
            <Route path="ki/generieren" element={<AiGeneratePage />} />
            <Route path="ki/fachgespraech" element={<AiExamPage />} />
            <Route path="ki/praesentation" element={<AiCoachPage />} />
            <Route path="statistik" element={<Placeholder title="Statistik" milestone={5} />} />
            <Route path="einstellungen" element={<SettingsPage />} />
            <Route path="*" element={<Placeholder title="Seite nicht gefunden" />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
