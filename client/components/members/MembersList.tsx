import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChurchBranch, Member } from "@shared/api";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Edit2, Search, Plus, Loader } from "lucide-react";

interface MembersListProps {
  onAddNew: () => void;
  onRefresh: () => void;
  refreshTrigger?: number;
  branches: ChurchBranch[];
  memberLimit: number | null;
}

export function MembersList({
  onAddNew,
  onRefresh,
  refreshTrigger,
  branches,
  memberLimit,
}: MembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { token } = useAuth();

  const fetchMembers = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/members", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [token, refreshTrigger]);

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase()) ||
      member.ministryGroup.toLowerCase().includes(search.toLowerCase())
  );
  const showBranchColumn = branches.length > 1;
  const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));
  const hasMemberLimit = memberLimit !== null;
  const hasReachedMemberLimit = hasMemberLimit && members.length >= memberLimit;
  const remainingMemberSlots = hasMemberLimit ? Math.max(memberLimit - members.length, 0) : null;

  return (
    <div className="space-y-4">
      {hasMemberLimit ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          {hasReachedMemberLimit
            ? `This plan is capped at ${memberLimit} members. Upgrade the church subscription to add more people.`
            : `${members.length} of ${memberLimit} member slots are in use. ${remainingMemberSlots} slot${remainingMemberSlots === 1 ? "" : "s"} remaining on this tier.`}
        </div>
      ) : null}

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by name, email, or ministry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Button
          onClick={onAddNew}
          disabled={hasReachedMemberLimit}
          className="bg-primary hover:bg-primary/90 text-white h-11"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            {members.length === 0 ? "No members yet. Add one to get started!" : "No members match your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  {showBranchColumn ? (
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                  ) : null}
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ministry</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Join Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{member.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.email}</td>
                    {showBranchColumn ? (
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {branchMap.get(member.branchId || "") || "Primary branch"}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {member.ministryGroup}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-100 text-green-700"
                            : member.status === "inactive"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.joinDate}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 hover:bg-blue-100 rounded-lg transition text-blue-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-red-100 rounded-lg transition text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
