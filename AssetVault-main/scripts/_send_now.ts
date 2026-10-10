import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
import { sendDailyOverduePlantMails } from "../server/dailyOverdueMail.js";

const result = await sendDailyOverduePlantMails({ force: true });
console.log(JSON.stringify(result));
