import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function LegacyRoomPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const roomName = resolvedParams.roomName;
  const initialName = resolvedSearchParams.name;

  const target = initialName
    ? `/meeting/${encodeURIComponent(roomName)}?name=${encodeURIComponent(initialName)}`
    : `/meeting/${encodeURIComponent(roomName)}`;

  redirect(target);
}
