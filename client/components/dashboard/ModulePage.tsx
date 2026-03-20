import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import Sidebar from "./Sidebar";
import { Inbox } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ModulePageProps {
  title: string;
  description: string;
}

export default function ModulePage({ title, description }: ModulePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, church, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-primary" />
            ) : (
              <Menu className="w-6 h-6 text-primary" />
            )}
          </button>

          <h1 className="text-2xl font-bold text-primary hidden lg:block">
            {title}
          </h1>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm text-gray-600">{church?.name || "Church"}</p>
              <p className="text-xs text-gray-500">{user?.role || "Admin"}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold text-white flex items-center justify-center font-semibold text-sm">
              {user?.name?.split(" ").map((n) => n[0]).join("") || "CD"}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex items-center justify-center px-6 py-12">
            <div className="max-w-md text-center">
              <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-primary mb-2">{title}</h2>
              <p className="text-gray-600 mb-8">{description}</p>
              <p className="text-sm text-gray-500 mb-6">
                This page is currently being built. Check back soon!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
