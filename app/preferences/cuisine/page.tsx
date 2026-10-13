import { redirect } from "next/navigation";

// Cuisine selection is now part of the cascading filter on the dishes page.
export default async function CuisinePage({
  searchParams,
}: {
  searchParams: Promise<{ quadId?: string }>;
}) {
  const { quadId } = await searchParams;
  redirect(quadId ? `/preferences/dishes?quadId=${quadId}` : "/home-choice");
}
