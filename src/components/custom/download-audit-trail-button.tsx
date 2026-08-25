// @polsia:user-owned — /sample-brief 'Download audit trail (PDF)' button
// (client island). On click: POSTs to /api/sample-brief/audit-pdf. The
// route composes the document server-side from the same SAMPLE_BRIEF +
// SCAFFOLD_DISCLAIMER constants the page renders, so the PDF is
// guaranteed to mirror the page even if the page island never resolves.
// Streams the resulting application/pdf back into a triggered download.
// Toasts on failure; spinner + 'Rendering…' while the route is in flight;
// disabled in-flight to prevent double posts.

'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export interface DownloadAuditTrailButtonProps {
  caseId?: string;
  className?: string;
}

export function DownloadAuditTrailButton({ caseId, className }: DownloadAuditTrailButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sample-brief/audit-pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: caseId ?? 'CARIFORGE-EU-CLAIMS-2026-Q2-014' }),
      });
      if (!res.ok) {
        throw new Error(`Audit trail PDF generation failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const header = res.headers.get('content-disposition') ?? '';
      const match = header.match(/filename="?([^";]+)"?/);
      link.download = match?.[1] ?? 'audit-trail.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not render the audit trail PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      <span>{loading ? 'Rendering…' : 'Download audit trail (PDF)'}</span>
    </Button>
  );
}
