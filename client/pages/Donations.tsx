import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Menu, X, Plus, Loader, Search, DollarSign } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { Donation } from "@shared/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import { formatUserRole } from "@/lib/auth";
import { formatChurchCurrency } from "@/lib/currency";

export default function Donations() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [formData, setFormData] = useState({
    memberId: "",
    amount: "",
    type: "tithe" as const,
    notes: "",
  });
  const [error, setError] = useState("");
  const { branch, user, church, token, logout } = useAuth();
  const { branches } = useChurchWorkspace({ enabled: !!token });
  const navigate = useNavigate();
  const branchMap = new Map(branches.map((item) => [item.id, item.name]));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    if (token) {
      fetchDonations();
      fetchMembers();
    }
  }, [token]);

  const fetchDonations = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/donations", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDonations(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch donations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!token) return;

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberId || !formData.amount) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add donation");
      }

      setFormData({
        memberId: "",
        amount: "",
        type: "tithe",
        notes: "",
      });
      setShowAddForm(false);
      await fetchDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add donation");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDonations = donations
    .filter((d) => {
      if (filterType !== "all" && d.type !== filterType) return false;
      return (
        d.memberName.toLowerCase().includes(search.toLowerCase()) ||
        d.id.toLowerCase().includes(search.toLowerCase())
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
  const averageGift = donations.length > 0 ? totalDonations / donations.length : 0;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
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
                <div className="bg-yellow-100 rounded-lg p-3">
                  <DollarSign className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Donations & Finance</h1>
                  <p className="text-xs text-gray-500">Track giving and financial records</p>
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
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <h3 className="text-gray-600 font-medium text-sm mb-3">Total Donations</h3>
                <p className="text-4xl font-bold text-primary mb-2">
                  {formatChurchCurrency(totalDonations)}
                </p>
                <div className="text-sm text-gray-600">All time giving</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <h3 className="text-gray-600 font-medium text-sm mb-3">Number of Gifts</h3>
                <p className="text-4xl font-bold text-gold mb-2">{donations.length}</p>
                <div className="text-sm text-gray-600">Total records</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <h3 className="text-gray-600 font-medium text-sm mb-3">Average Gift</h3>
                <p className="text-4xl font-bold text-primary mb-2">
                  {formatChurchCurrency(averageGift)}
                </p>
                <div className="text-sm text-gray-600">Per donation</div>
              </div>
            </div>

            {/* Add Donation Form */}
            {showAddForm && (
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-primary mb-4">Record Donation</h3>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Member</Label>
                      <Select value={formData.memberId} onValueChange={(value) => setFormData({ ...formData, memberId: value })}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Amount (GHS)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        step="0.01"
                        min="0"
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Type</Label>
                      <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tithe">Tithe</SelectItem>
                          <SelectItem value="offering">Offering</SelectItem>
                          <SelectItem value="special_gift">Special Gift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Notes</Label>
                      <Input
                        placeholder="Optional notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {isLoading ? "Recording..." : "Record Donation"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Donation
              </Button>
            )}

            {/* Donations List */}
            <div className="bg-white rounded-xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                      placeholder="Search donations..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-11 w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="tithe">Tithes</SelectItem>
                      <SelectItem value="offering">Offerings</SelectItem>
                      <SelectItem value="special_gift">Special Gifts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredDonations.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  No donations recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Member</th>
                        {branches.length > 1 ? (
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                        ) : null}
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDonations.map((donation) => (
                        <tr key={donation.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {donation.memberName}
                          </td>
                          {branches.length > 1 ? (
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {branchMap.get(donation.branchId || "") || "Primary branch"}
                            </td>
                          ) : null}
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              donation.type === "tithe"
                                ? "bg-blue-100 text-blue-700"
                                : donation.type === "offering"
                                ? "bg-green-100 text-green-700"
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {donation.type === "tithe"
                                ? "Tithe"
                                : donation.type === "offering"
                                ? "Offering"
                                : "Special Gift"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-primary text-right">
                            {formatChurchCurrency(donation.amount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{donation.date}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{donation.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

