const { PrismaClient } = require("@prisma/client");
const redis = require("redis");

/**
 * Gerenciador de Usuários
 * Responsável por operações de banco de dados, Redis e utilitários de usuários
 */

class UserManager {
  constructor() {
    this.prisma = new PrismaClient();
    this.redisClient = null;
  }

  /**
   * Inicializa conexão com Redis
   */
  async initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      this.redisClient = redis.createClient({ url: redisUrl });

      this.redisClient.on("error", (err) =>
        console.error("❌ Redis Error:", err)
      );

      await this.redisClient.connect();
      console.log("✅ Conectado ao Redis\n");

      return this.redisClient;
    } catch (error) {
      console.warn(
        "⚠️  Redis não disponível, continuando sem cache:",
        error.message
      );
      return null;
    }
  }

  /**
   * Busca invites com facial_image do banco de dados
   * Prioriza guests sobre participants para o mesmo inviteId
   */
  async fetchInvitesWithFacialImages() {
    try {
      const eventId = process.env.EVENT_ID;
      if (!eventId) {
        throw new Error("EVENT_ID não está definido nas variáveis de ambiente");
      }

      // Busca participantes com facial_image
      const participants = await this.prisma.participant.findMany({
        where: {
          invite: {
            some: {
              event_id: eventId,
            },
          },
          facial_image: {
            not: null,
          },
        },
        include: {
          invite: true,
        },
      });

      // Busca convidados com facial_image
      const guests = await this.prisma.guest.findMany({
        where: {
          invite: {
            some: {
              event_id: eventId,
            },
          },
          facial_image: {
            not: null,
          },
        },
        include: {
          invite: true,
        },
      });

      // Converte para formato unificado
      const allUsers = [
        ...participants.map((p) => ({
          userId: p.id,
          name: p.name,
          email: p.email,
          document: p.document,
          cellphone: p.cellphone,
          facialImageUrl: p.facial_image,
          type: "participant",
          inviteId: p.invite[0]?.id, // Pega o primeiro invite
          priority: 1, // Prioridade menor para participants
        })),
        ...guests.map((g) => ({
          userId: g.id,
          name: g.name,
          email: g.email,
          document: g.document,
          cellphone: g.cellphone,
          facialImageUrl: g.facial_image,
          type: "guest",
          inviteId: g.invite[0]?.id, // Pega o primeiro invite
          priority: 2, // Prioridade maior para guests
        })),
      ];

      // Agrupa por inviteId e seleciona o de maior prioridade (guest)
      const usersByInvite = new Map();

      allUsers.forEach((user) => {
        const existingUser = usersByInvite.get(user.inviteId);

        if (!existingUser || user.priority > existingUser.priority) {
          usersByInvite.set(user.inviteId, user);
        }
      });

      // Converte de volta para array
      const users = Array.from(usersByInvite.values());

      console.log(
        `📊 Encontrados ${users.length} usuários únicos por inviteId`
      );
      console.log(`   👥 Participantes: ${participants.length}`);
      console.log(`   👤 Convidados: ${guests.length}`);
      console.log(`   🎯 Únicos selecionados: ${users.length}`);
      console.log(`   📋 Prioridade: Guest > Participant\n`);

      return users;
    } catch (error) {
      console.error("❌ Erro ao buscar usuários:", error.message);
      throw error;
    }
  }

  /**
   * Busca invites com facial_image modificados desde último processamento
   * Prioriza guests sobre participants para o mesmo inviteId
   * @param {Date} lastProcessedTimestamp - Timestamp da última execução
   */
  async fetchInvitesWithFacialImagesIncremental(lastProcessedTimestamp) {
    try {
      const eventId = process.env.EVENT_ID;
      if (!eventId) {
        throw new Error("EVENT_ID não está definido nas variáveis de ambiente");
      }

      if (!lastProcessedTimestamp) {
        console.log("⚠️  Nenhum timestamp fornecido, retornando vazio");
        return [];
      }

      // Busca participantes modificados desde lastProcessedTimestamp
      const participants = await this.prisma.participant.findMany({
        where: {
          invite: {
            some: {
              event_id: eventId,
            },
          },
          facial_image: {
            not: null,
          },
          updated_at: {
            gt: lastProcessedTimestamp,
          },
        },
        include: {
          invite: true,
        },
      });

      // Busca convidados modificados desde lastProcessedTimestamp
      const guests = await this.prisma.guest.findMany({
        where: {
          invite: {
            some: {
              event_id: eventId,
            },
          },
          facial_image: {
            not: null,
          },
          updated_at: {
            gt: lastProcessedTimestamp,
          },
        },
        include: {
          invite: true,
        },
      });

      // Converte para formato unificado
      const allUsers = [
        ...participants.map((p) => ({
          userId: p.id,
          name: p.name,
          email: p.email,
          document: p.document,
          cellphone: p.cellphone,
          facialImageUrl: p.facial_image,
          type: "participant",
          inviteId: p.invite[0]?.id, // Pega o primeiro invite
          priority: 1, // Prioridade menor para participants
        })),
        ...guests.map((g) => ({
          userId: g.id,
          name: g.name,
          email: g.email,
          document: g.document,
          cellphone: g.cellphone,
          facialImageUrl: g.facial_image,
          type: "guest",
          inviteId: g.invite[0]?.id, // Pega o primeiro invite
          priority: 2, // Prioridade maior para guests
        })),
      ];

      // Agrupa por inviteId e seleciona o de maior prioridade (guest)
      const usersByInvite = new Map();

      allUsers.forEach((user) => {
        const existingUser = usersByInvite.get(user.inviteId);

        if (!existingUser || user.priority > existingUser.priority) {
          usersByInvite.set(user.inviteId, user);
        }
      });

      // Converte de volta para array
      const users = Array.from(usersByInvite.values());

      console.log(
        `📊 Encontrados ${users.length} usuários modificados desde última execução`
      );
      console.log(`   👥 Participantes modificados: ${participants.length}`);
      console.log(`   👤 Convidados modificados: ${guests.length}`);
      console.log(`   🎯 Únicos selecionados: ${users.length}`);
      console.log(`   📋 Prioridade: Guest > Participant`);
      console.log(
        `   ⏰ Último processamento: ${lastProcessedTimestamp.toISOString()}\n`
      );

      return users;
    } catch (error) {
      console.error("❌ Erro ao buscar usuários modificados:", error.message);
      throw error;
    }
  }

  /**
   * Obtém timestamp da última execução bem-sucedida
   * Tenta Redis primeiro, depois fallback para arquivo
   * @returns {Date|null} Timestamp da última execução ou null se não existir
   */
  async getLastProcessedTimestamp() {
    const fs = require("fs");
    const path = require("path");
    const lockFile = path.join(
      __dirname,
      "..",
      "..",
      ".last-processed-timestamp.json"
    );

    try {
      // Tenta obter do Redis primeiro
      if (this.redisClient) {
        try {
          const timestampStr = await this.redisClient.get(
            "facial-registration:last-processed-timestamp"
          );
          if (timestampStr) {
            const timestamp = new Date(timestampStr);
            console.log(
              `📅 Último processamento (Redis): ${timestamp.toISOString()}`
            );
            return timestamp;
          }
        } catch (error) {
          console.warn(`⚠️  Erro ao ler timestamp do Redis: ${error.message}`);
        }
      }

      // Fallback para arquivo
      if (fs.existsSync(lockFile)) {
        const lockData = JSON.parse(fs.readFileSync(lockFile, "utf8"));
        if (lockData.timestamp) {
          const timestamp = new Date(lockData.timestamp);
          console.log(
            `📅 Último processamento (arquivo): ${timestamp.toISOString()}`
          );
          return timestamp;
        }
      }

      console.log("ℹ️  Nenhum timestamp de processamento anterior encontrado");
      return null;
    } catch (error) {
      console.warn(`⚠️  Erro ao obter timestamp: ${error.message}`);
      return null;
    }
  }

  /**
   * Salva timestamp da execução atual
   * Salva no Redis e no arquivo (fallback)
   * @param {Date} timestamp - Timestamp a ser salvo (padrão: agora)
   */
  async saveLastProcessedTimestamp(timestamp = null) {
    const fs = require("fs");
    const path = require("path");
    const lockFile = path.join(
      __dirname,
      "..",
      "..",
      ".last-processed-timestamp.json"
    );

    const timestampToSave = timestamp || new Date();
    const timestampStr = timestampToSave.toISOString();

    try {
      // Salva no Redis
      if (this.redisClient) {
        try {
          await this.redisClient.set(
            "facial-registration:last-processed-timestamp",
            timestampStr
          );
          console.log(`💾 Timestamp salvo no Redis: ${timestampStr}`);
        } catch (error) {
          console.warn(
            `⚠️  Erro ao salvar timestamp no Redis: ${error.message}`
          );
        }
      }

      // Salva no arquivo (fallback)
      try {
        const lockData = {
          timestamp: timestampStr,
          savedAt: new Date().toISOString(),
        };
        fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
        console.log(`💾 Timestamp salvo no arquivo: ${timestampStr}`);
      } catch (error) {
        console.warn(
          `⚠️  Erro ao salvar timestamp no arquivo: ${error.message}`
        );
      }
    } catch (error) {
      console.error(`❌ Erro ao salvar timestamp: ${error.message}`);
    }
  }

  /**
   * Separa nome completo em primeiro nome e último sobrenome
   */
  splitName(fullName) {
    if (!fullName || typeof fullName !== "string") {
      return { firstName: "Usuario", lastName: "Sem Nome" };
    }

    const nameParts = fullName.trim().split(/\s+/);

    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: "Sem Sobrenome" };
    }

    // Pega apenas o primeiro nome e último sobrenome
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1]; // Último elemento

    return { firstName, lastName };
  }

  /**
   * Formata nome para envio à catraca (apenas primeiro nome e último sobrenome)
   */
  formatNameForDevice(fullName) {
    const { firstName, lastName } = this.splitName(fullName);
    const formattedName = `${firstName} ${lastName}`.trim();

    // Limita a 50 caracteres conforme especificação da API
    return formattedName.length > 50
      ? formattedName.substring(0, 50)
      : formattedName;
  }

  /**
   * Salva usuário no Redis e cache JSON
   */
  async saveUser(deviceIp, userId, userData, cacheManager) {
    try {
      let redisSuccess = false;
      let jsonSuccess = false;

      // Salva no Redis (usando inviteId como chave se disponível)
      if (this.redisClient) {
        const key = `device:${deviceIp}:users`;
        const value = userData.inviteId
          ? `${userId}:${userData.inviteId}`
          : userId;
        await this.redisClient.sAdd(key, value);
        redisSuccess = true;
      }

      // Salva no cache JSON
      if (cacheManager) {
        jsonSuccess = await cacheManager.addUser(deviceIp, userId, userData);
      }

      return {
        success: redisSuccess || jsonSuccess,
        redis: redisSuccess,
        json: jsonSuccess,
      };
    } catch (error) {
      console.error(`   ⚠️  Erro ao salvar usuário: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove usuário do Redis e cache JSON
   */
  async removeUser(deviceIp, userId, cacheManager) {
    try {
      let redisSuccess = false;
      let jsonSuccess = false;

      // Remove do Redis
      if (this.redisClient) {
        const key = `device:${deviceIp}:users`;
        await this.redisClient.sRem(key, userId);
        redisSuccess = true;
      }

      // Remove do cache JSON
      if (cacheManager) {
        jsonSuccess = await cacheManager.removeUser(deviceIp, userId);
      }

      return {
        success: redisSuccess || jsonSuccess,
        redis: redisSuccess,
        json: jsonSuccess,
      };
    } catch (error) {
      console.error(`   ⚠️  Erro ao remover usuário: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Divide array em lotes de tamanho especificado
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Fecha conexões
   */
  async close() {
    try {
      await this.prisma.$disconnect();
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log("✅ Conexões fechadas");
      }
    } catch (error) {
      console.error("❌ Erro ao fechar conexões:", error.message);
    }
  }
}

module.exports = UserManager;
