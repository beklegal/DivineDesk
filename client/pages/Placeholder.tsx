import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Inbox, MessageCircle } from "lucide-react";

const pageDescriptions: Record<string, { title: string; description: string }> = {
  "/members": {
    title: "Member Management",
    description: "Manage your church members, add new members, and organize them by ministry groups.",
  },
  "/donations": {
    title: "Donations & Finance",
    description: "Track tithes, offerings, and special donations. Generate financial reports and receipts.",
  },
  "/events": {
    title: "Events & Services",
    description: "Create and manage church services, events, and special meetings.",
  },
  "/attendance": {
    title: "Attendance Tracking",
    description: "Record attendance for services and view attendance history and trends.",
  },
  "/reports": {
    title: "Reports & Analytics",
    description: "Generate comprehensive reports about members, donations, events, and attendance.",
  },
  "/settings": {
    title: "Settings",
    description: "Manage your church profile, users, and system settings.",
  },
};

export default function Placeholder() {
  const location = useLocation();
  const pageInfo = pageDescriptions[location.pathname] || {
    title: "Page",
    description: "This page is coming soon.",
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Inbox className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">{pageInfo.title}</h1>
          <p className="text-gray-600 mb-8">{pageInfo.description}</p>
          <p className="text-sm text-gray-500 mb-6">
            This page is currently being built. Check back soon!
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                Want to help us prioritize building this feature? Let us know what you need!
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.history.back()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
