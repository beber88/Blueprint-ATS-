import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createAdminClient();

    const users = [
      {
        email: "hr@blueprint-ph.com",
        password: "Blueprint2024!",
        full_name: "Nicx",
        role: "recruiter",
        job_title: "HR and Office Manager",
        phone: "+639542807121",
      },
      {
        email: "roseanne.penaflor8612@gmail.com",
        password: "Blueprint2024!",
        full_name: "Rose",
        role: "recruiter",
        job_title: "Office Secretary",
        phone: "+639673351409",
      },
    ];

    const results = [];

    for (const u of users) {
      // Check if user already exists
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id, email")
        .eq("email", u.email)
        .single();

      if (existing) {
        results.push({ email: u.email, status: "already_exists", id: existing.id });
        continue;
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.full_name,
          role: u.role,
          job_title: u.job_title,
          phone: u.phone,
        },
      });

      if (authError) {
        console.error(`Failed to create auth user ${u.email}:`, authError);
        results.push({ email: u.email, status: "auth_error", error: authError.message });
        continue;
      }

      // The trigger should auto-create profile, but upsert as safety net
      if (authUser.user) {
        await supabase.from("user_profiles").upsert({
          id: authUser.user.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          is_active: true,
        }, { onConflict: "id" });

        results.push({ email: u.email, status: "created", id: authUser.user.id });
        console.log(`Created user: ${u.full_name} (${u.email}) as ${u.role}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Create users error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
