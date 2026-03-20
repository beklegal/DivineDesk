import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import type { ChurchBranch } from "@shared/api";
import { X, Loader } from "lucide-react";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branches: ChurchBranch[];
  defaultBranchId?: string;
  canChooseBranch: boolean;
}

export function AddMemberModal({
  isOpen,
  onClose,
  onSuccess,
  branches,
  defaultBranchId,
  canChooseBranch,
}: AddMemberModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    branchId: defaultBranchId ?? "",
    name: "",
    email: "",
    phone: "",
    address: "",
    ministryGroup: "General",
    status: "active" as const,
    notes: "",
  });
  const { token } = useAuth();

  const ministries = [
    "General",
    "Worship Team",
    "Youth Ministry",
    "Outreach",
    "Prayer Team",
    "Children's Ministry",
    "Discipleship",
    "Finance",
  ];

  const branchLabel = useMemo(
    () => branches.find((branch) => branch.id === formData.branchId)?.name ?? "Primary branch",
    [branches, formData.branchId],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      branchId: previous.branchId || defaultBranchId || branches[0]?.id || "",
    }));
  }, [branches, defaultBranchId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to add member");
      }

      setFormData({
        branchId: defaultBranchId ?? branches[0]?.id ?? "",
        name: "",
        email: "",
        phone: "",
        address: "",
        ministryGroup: "General",
        status: "active",
        notes: "",
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary">Add New Member</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-primary font-semibold">
              Branch
            </Label>
            {canChooseBranch ? (
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={branchLabel} disabled className="h-10 bg-gray-50" />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-primary font-semibold">
              Name
            </Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-primary font-semibold">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-primary font-semibold">
              Phone
            </Label>
            <Input
              id="phone"
              placeholder="555-0123"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-primary font-semibold">
              Address
            </Label>
            <Input
              id="address"
              placeholder="123 Main St"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ministry" className="text-primary font-semibold">
              Ministry Group
            </Label>
            <Select value={formData.ministryGroup} onValueChange={(value) => setFormData({ ...formData, ministryGroup: value })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ministries.map((ministry) => (
                  <SelectItem key={ministry} value={ministry}>
                    {ministry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-primary font-semibold">
              Status
            </Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="visitor">Visitor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-primary font-semibold">
              Notes
            </Label>
            <textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Member"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
