import dotenv from "dotenv"
import path from "path"
import Globals from "./app/Globals"

dotenv.config({ path: path.join(__dirname, "..", ".env") })

Globals.client
  .login(process.env.TOKEN || Globals.bot.token)
  .then((token) => {
    Globals.bot.token = token
  })
  .catch(console.error)
