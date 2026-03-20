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
import { LogOut, Menu, X, Plus, Loader, Search, CheckCircle, XCircle } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { ChurchEvent, Member } from "@shared/api";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import { formatUserRole } from "@/lib/auth";

export default function Attendance() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    eventId: "",
    memberId: "",
    attended: true,
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
      fetchEvents();
      fetchMembers();
    }
  }, [token]);

  const fetchEvents = async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents((data.data || []).filter((e: any) => e.status === "scheduled"));
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
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

  const submitAttendance = async (payload: typeof formData) => {
    if (!payload.eventId || !payload.memberId) {
      setError("Please select an event and member");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      setFormData({
        eventId: "",
        memberId: "",
        attended: true,
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitAttendance(formData);
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );
  const selectedEventDetails = events.find((event) => event.id === selectedEvent);
  const branchScopedMembers = selectedEventDetails?.branchId
    ? filteredMembers.filter((member) => member.branchId === selectedEventDetails.branchId)
    : filteredMembers;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
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
            Attendance Tracking
          </h1>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm text-gray-600">{church?.name}</p>
              <p className="text-xs text-gray-500">
                {branch?.name
                  ? `${branch.name}  -  ${formatUserRole(user?.role)}`
                  : formatUserRole(user?.role)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold text-white flex items-center justify-center font-semibold text-sm">
              {user?.name?.split(" ").map((n) => n[0]).join("") || "CD"}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-gray-600 font-medium mb-2">Total Members</h3>
                <p className="text-3xl font-bold text-primary">{members.length}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-gray-600 font-medium mb-2">Upcoming Services</h3>
                <p className="text-3xl font-bold text-gold">{events.length}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-gray-600 font-medium mb-2">Avg. Attendance Rate</h3>
                <p className="text-3xl font-bold text-primary">78.9%</p>
              </div>
            </div>

            {/* Mark Attendance Form */}
            {showForm && (
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-primary mb-4">Mark Attendance</h3>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Service/Event *</Label>
                      <Select
                        value={formData.eventId}
                        onValueChange={(value) => setFormData({ ...formData, eventId: value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          {events.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.name} - {event.date}
                              {branches.length > 1 && event.branchId
                                ? ` (${branchMap.get(event.branchId) || "Primary branch"})`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Member *</Label>
                      <Select
                        value={formData.memberId}
                        onValueChange={(value) => setFormData({ ...formData, memberId: value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchScopedMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                              {branches.length > 1 && member.branchId
                                ? ` (${branchMap.get(member.branchId) || "Primary branch"})`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Status</Label>
                      <Select
                        value={formData.attended ? "present" : "absent"}
                        onValueChange={(value) => setFormData({ ...formData, attended: value === "present" })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {isLoading ? "Marking..." : "Mark Attendance"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {!showForm && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
            )}

            {/* Quick Check-in Grid */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-primary mb-4">
                {selectedEvent ? "Check-in Members" : "Select an Event"}
              </h3>

              {events.length > 0 && !selectedEvent && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition text-left"
                    >
                      <h4 className="font-semibold text-primary">{event.name}</h4>
                      <p className="text-sm text-gray-600">{event.date} at {event.time}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {event.location}
                        {branches.length > 1 && event.branchId
                          ? `  -  ${branchMap.get(event.branchId) || "Primary branch"}`
                          : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {selectedEvent && (
                <div>
                  <div className="mb-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedEvent("")}
                      className="text-primary border-primary"
                    >
                      ← Back
                    </Button>
                  </div>

                  <div className="flex-1 relative mb-6">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                      placeholder="Search members..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                    {branchScopedMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          const nextFormData = {
                            eventId: selectedEvent,
                            memberId: member.id,
                            attended: true,
                          };
                          setFormData(nextFormData);
                          submitAttendance(nextFormData);
                        }}
                        className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{member.name}</h4>
                            <p className="text-xs text-gray-600">
                              {member.ministryGroup}
                              {branches.length > 1 && member.branchId
                                ? `  -  ${branchMap.get(member.branchId) || "Primary branch"}`
                                : ""}
                            </p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {branchScopedMembers.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                      No members match your search
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

