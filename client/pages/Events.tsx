import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Menu, X, Plus, Loader, Calendar } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { ChurchEvent } from "@shared/api";
import { canManageChurchWorkspace } from "@shared/permissions";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import { formatUserRole } from "@/lib/auth";

export default function Events() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    branchId: "",
    name: "",
    date: "",
    time: "",
    location: "",
    description: "",
    type: "service" as const,
    maxAttendees: "",
  });
  const [error, setError] = useState("");
  const { branch, user, church, token, logout } = useAuth();
  const { branches, currentBranch } = useChurchWorkspace({ enabled: !!token });
  const navigate = useNavigate();
  const canChooseBranch = canManageChurchWorkspace(user);
  const branchMap = new Map(branches.map((item) => [item.id, item.name]));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    if (token) {
      fetchEvents();
    }
  }, [token]);

  useEffect(() => {
    if (!branches.length) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      branchId: previous.branchId || currentBranch?.id || church?.primaryBranchId || branches[0].id,
    }));
  }, [branches, church?.primaryBranchId, currentBranch?.id]);

  const fetchEvents = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.date || !formData.time || !formData.location) {
      setError("Please fill in all required fields");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      setFormData({
        branchId: currentBranch?.id || church?.primaryBranchId || branches[0]?.id || "",
        name: "",
        date: "",
        time: "",
        location: "",
        description: "",
        type: "service",
        maxAttendees: "",
      });
      setShowAddForm(false);
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingEvents = events
    .filter((e) => e.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "service":
        return "bg-blue-100 text-blue-700";
      case "event":
        return "bg-purple-100 text-purple-700";
      case "meeting":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

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
                <div className="bg-purple-100 rounded-lg p-3">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">Events & Services</h1>
                  <p className="text-xs text-gray-500">Manage church events and services</p>
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
                <h3 className="text-gray-600 font-medium text-sm mb-3">Upcoming Events</h3>
                <p className="text-4xl font-bold text-primary mb-2">{upcomingEvents.length}</p>
                <div className="text-sm text-gray-600">Scheduled services</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <h3 className="text-gray-600 font-medium text-sm mb-3">Total Events</h3>
                <p className="text-4xl font-bold text-gold mb-2">{events.length}</p>
                <div className="text-sm text-gray-600">All records</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <h3 className="text-gray-600 font-medium text-sm mb-3">Total Registrations</h3>
                <p className="text-4xl font-bold text-primary mb-2">
                  {events.reduce((sum, e) => sum + e.registeredAttendees, 0)}
                </p>
                <div className="text-sm text-gray-600">Registered attendees</div>
              </div>
            </div>

            {/* Add Event Form */}
            {showAddForm && (
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-primary mb-4">Create New Event</h3>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Branch</Label>
                      {canChooseBranch ? (
                        <select
                          value={formData.branchId}
                          onChange={(e) =>
                            setFormData({ ...formData, branchId: e.target.value })
                          }
                          className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                        >
                          {branches.map((branchOption) => (
                            <option key={branchOption.id} value={branchOption.id}>
                              {branchOption.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={branch?.name || branchMap.get(formData.branchId) || "Primary branch"}
                          disabled
                          className="h-11 bg-gray-50"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Event Name *</Label>
                      <Input
                        placeholder="Sunday Service"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Type</Label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                      >
                        <option value="service">Service</option>
                        <option value="event">Event</option>
                        <option value="meeting">Meeting</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Date *</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Time *</Label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Location *</Label>
                      <Input
                        placeholder="Main Sanctuary"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-primary font-semibold">Max Attendees</Label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={formData.maxAttendees}
                        onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
                        min="0"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-primary font-semibold">Description</Label>
                    <textarea
                      placeholder="Event description..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                      rows={3}
                    />
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
                      {isLoading ? "Creating..." : "Create Event"}
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
                Create Event
              </Button>
            )}

            {/* Events Grid */}
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-600 border border-gray-100">
                No upcoming events scheduled.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-primary mb-2">{event.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </span>
                          {branches.length > 1 ? (
                            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                              {branchMap.get(event.branchId || "") || "Primary branch"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-medium">{event.date} at {event.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <span className="font-medium">{event.location}</span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-700 mt-3 italic">{event.description}</p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Registrations</p>
                          <p className="text-lg font-bold text-primary">
                            {event.registeredAttendees}{event.maxAttendees ? `/${event.maxAttendees}` : ""}
                          </p>
                        </div>
                        {event.maxAttendees && (
                          <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-semibold text-primary">
                            {Math.round((event.registeredAttendees / event.maxAttendees) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

