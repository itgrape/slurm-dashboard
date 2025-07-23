import { Routes, Route } from "react-router-dom";

// 导入布局和页面组件
import MainLayout from "../layouts/MainLayout";
import Dashboard from "../pages/Dashboard";
import Jobs from "../pages/Jobs";
import Login from "../pages/Login";
import ProtectedRoute from "./ProtectedRoute";
import ScriptGenerator from "../pages/ScriptGenerator";
import Tutorial from "../pages/Tutorial";
import BatchJob from "../pages/JobBatch";
import DebugJob from "../pages/JobDebug";

export default function AppRoutes() {
    return (
        <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<Login />} />

            {/* 受保护路由 */}
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="job-debug" element={<DebugJob />} />
                    <Route path="job-batch" element={<BatchJob />} />
                    <Route path="script-generator" element={<ScriptGenerator />} />
                    <Route path="tutorial" element={<Tutorial />} />
                </Route>
            </Route>
        </Routes>
    );
}
