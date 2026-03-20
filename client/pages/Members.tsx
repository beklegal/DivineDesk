import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, Users } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { MembersList } from "@/components/members/MembersList";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { canManageChurchWorkspace } from "@shared/permissions";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import { formatUserRole } from "@/lib/auth";

export default function Members() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { branch, user, church, logout } = useAuth();
  const { branches, currentBranch } = useChurchWorkspace();
  const navigate = useNavigate();
  const canChooseBranch = canManageChurchWorkspace(user);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleAddSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
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

              <div className="hidden lg:flex items-center gap-3">
                <div className="bg-blue-100 rounded-lg p-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Member Management</h1>
                  <p className="text-xs text-gray-500">Manage church members</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {branch?.name
                    ? `${branch.name}  -  ${formatUserRole(user?.role)}`
                    : formatUserRole(user?.role)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center font-bold text-sm">
                {user?.name?.split(" ").map((n) => n[0]).join("") || "CD"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-primary hover:bg-primary/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-primary mb-2">Members</h2>
              <p className="text-gray-600">
                Manage your church members and organize them by ministry groups
              </p>
            </div>

            <MembersList
              onAddNew={() => setShowAddModal(true)}
              onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
              refreshTrigger={refreshTrigger}
              branches={branches}
            />
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        branches={branches}
        canChooseBranch={canChooseBranch}
        defaultBranchId={currentBranch?.id ?? church?.primaryBranchId ?? branches[0]?.id}
      />
    </div>
  );
}

