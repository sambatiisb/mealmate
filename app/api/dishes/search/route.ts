import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const quadId = searchParams.get("quadId");
  const q = searchParams.get("q")?.trim() ?? "";
  const cuisine = searchParams.get("cuisine") ?? "";
  const menuCategory = searchParams.get("menuCategory") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const vegOnly = searchParams.get("vegOnly") === "true";

  if (!quadId) {
    return NextResponse.json({ error: "quadId is required" }, { status: 400 });
  }

  const dishes = await prisma.dish.findMany({
    where: {
      OR: [{ source: "curated" }, { quadId }],
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(cuisine ? { cuisine } : {}),
      ...(menuCategory ? { menuCategory } : {}),
      ...(subcategory && subcategory !== "All" ? { subcategory } : {}),
      ...(vegOnly ? { isVeg: true } : {}),
    },
    orderBy: { name: "asc" },
    take: 60,
    select: {
      id: true,
      name: true,
      cuisine: true,
      subcategory: true,
      dishType: true,
      foodType: true,
      isVeg: true,
      containsEgg: true,
      imageUrl: true,
      containsFlags: true,
    },
  });

  return NextResponse.json({ dishes });
}
