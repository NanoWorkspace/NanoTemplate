import Discord from "discord.js"
import Globals from "../app/Globals"
import Text from "../utils/text"
import Embed from "../app/Embed"
import Command from "../app/Command"
import Event from "../app/Event"

new Event<"message">({
  name: "message",
  description: "Handle commands on message create",
  caller: "on",
  call: async (message) => {
    if (
      message.system ||
      !message.author ||
      message.author.bot ||
      message.webhookID ||
      message.deleted
    )
      return

    // check prefix
    let prefix = "nano ",
      content
    if (message.guild) {
      prefix = Globals.db.get(message.guild.id, "prefix")
    }
    if (message.content.startsWith(prefix)) {
      content = message.content.replace(prefix, "").trim()
    } else return

    // command handler test
    const { command, rest } = Command.resolve(content)
    if (!command) return

    content = rest as string

    // command arguments parsing
    const args: { [name: string]: any } = {}
    if (command.args) {
      let tempContent = content
      for (const name in command.args) {
        const { arg, rest } = await command.args[name](tempContent, message)
        args[name] = arg
        tempContent = rest || ""
      }
    }

    const embed = new Embed()

    // check filters
    if (message.guild) {
      if (command.channelType === "dm")
        return message.channel.send(
          embed.setTemplate("Error", "Utilisable seulement en DM.")
        )
      if (command.owner) {
        if (message.member !== message.guild.owner)
          return message.channel.send(
            embed.setTemplate("Error", "Utilisable seulement par un owner.")
          )
      }
      if (command.admin) {
        if (
          !message.member?.hasPermission("ADMINISTRATOR", { checkOwner: true })
        )
          return message.channel.send(
            embed.setTemplate("Error", "Utilisable seulement par un admin.")
          )
      }
      if (command.permissions) {
        if (
          command.permissions.some((permission) => {
            return message.member?.permissions.missing(permission)
          })
        )
          return message.channel.send(
            embed
              .setTemplate(
                "error",
                "Vous n'avez pas les permissions pour utiliser cette commande."
              )
              .addField(
                "Permissions requises:",
                Text.code(command.permissions.join("\n"))
              )
          )
      }
    } else {
      if (
        command.channelType === "guild" ||
        command.permissions ||
        command.owner ||
        command.admin
      )
        return message.channel.send(
          embed.setTemplate("Error", "Utilisable seulement dans un serveur.")
        )
    }
    if (command.botOwner) {
      if (Globals.owners.every((user) => user !== message.author)) {
        return message.channel.send(
          embed
            .setTemplate(
              "error",
              "Vous devez êtes l'un des propriétaires du bot pour utiliser cette commande."
            )
            .addField(
              "Voici les propriétaires actuels:",
              Text.code(Globals.owners.map((user) => user.tag).join("\n"))
            )
        )
      }
    }
    if (command.users) {
      if (
        command.users.every((user) => {
          return Globals.client.users.resolve(user) !== message.author
        })
      )
        return message.channel.send(
          embed
            .setTemplate(
              "Error",
              "Vous n'êtes pas autorisés a utiliser cette commande."
            )
            .addField(
              "Utilisateurs autorisés:",
              Text.code(
                command.users
                  .map((user) => {
                    return Globals.client.users.resolve(user)?.tag
                  })
                  .join("\n")
              )
            )
        )
    }

    // check cooldown
    if (command.cooldown) {
      // just narrowing test for TypeScript
      if (!command.name) return

      const { cooldown } = Globals
      const now = Date.now()

      if (!cooldown.hasOwnProperty(message.author.id)) {
        cooldown[message.author.id] = {
          [command.name]: now,
        }
      } else {
        if (cooldown[message.author.id].hasOwnProperty(command.name)) {
          const lastUsage = cooldown[message.author.id][command.name]
          if (command.cooldown > now - lastUsage) {
            return message.channel.send(
              embed.setTemplate(
                "error",
                `Utilisable dans seulement \`${
                  command.cooldown - (now - lastUsage)
                }\` ms`
              )
            )
          }
        }
      }
      cooldown[message.author.id][command.name] = now
    }

    // start typing
    if (command.typing) {
      message.channel.startTyping()
    }

    // launch command
    await command.call({
      message,
      args,
    })

    // stop typing
    if (command.typing) {
      await message.channel.stopTyping(true)
    }
  },
})