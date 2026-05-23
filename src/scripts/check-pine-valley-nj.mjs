import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data } = await s.from("Course").select("id, name, city, state, zipCode, yearEstablished, courseType, description, websiteUrl").eq("name", "Pine Valley Golf Club").eq("state", "NJ");
console.log(JSON.stringify(data, null, 2));
if (data?.[0]) {
  const { data: h } = await s.from("Hole").select("holeNumber, par, yardage, handicapRank").eq("courseId", data[0].id).order("holeNumber");
  console.log("\nHoles:", h.length, "Total par:", h.reduce((sum,x)=>sum+x.par,0), "Total yds:", h.reduce((sum,x)=>sum+(x.yardage||0),0));
}
