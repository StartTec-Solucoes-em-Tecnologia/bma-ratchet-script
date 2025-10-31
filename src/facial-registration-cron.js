const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const FacialRegistrationService = require("./facial-registration-v2");

/**
 * Cron Job para Registro Facial Automático
 * Executa a cada 5 minutos com proteção contra execuções sobrepostas
 */

class FacialRegistrationCron {
  constructor() {
    this.isRunning = false;
    this.lockFile = path.join(__dirname, "..", ".facial-registration.lock");
    this.cronExpression = "*/5 * * * *"; // A cada 5 minutos
    this.service = null;
  }

  /**
   * Verifica se há uma execução em andamento
   */
  checkLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        // Verifica se o processo do lock ainda está rodando
        const lockData = JSON.parse(fs.readFileSync(this.lockFile, "utf8"));
        const lockPid = lockData.pid;
        const lockTime = lockData.timestamp;

        // Verifica se o processo ainda existe
        try {
          process.kill(lockPid, 0); // Signal 0 apenas verifica se o processo existe
          // Se chegou aqui, o processo existe
          const elapsed = Date.now() - lockTime;
          const maxLockTime = 30 * 60 * 1000; // 30 minutos máximo

          if (elapsed > maxLockTime) {
            console.warn(
              `⚠️  Lock antigo detectado (${Math.round(
                elapsed / 1000 / 60
              )} min), removendo...`
            );
            this.releaseLock();
            return false;
          }
          return true; // Lock válido
        } catch (error) {
          // Processo não existe mais, remove lock órfão
          console.warn(`⚠️  Lock órfão detectado, removendo...`);
          this.releaseLock();
          return false;
        }
      }
      return false;
    } catch (error) {
      console.warn(`⚠️  Erro ao verificar lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Cria arquivo de lock
   */
  createLock() {
    try {
      const lockData = {
        pid: process.pid,
        timestamp: Date.now(),
        startedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2));
    } catch (error) {
      console.error(`❌ Erro ao criar lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove arquivo de lock
   */
  releaseLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      console.warn(`⚠️  Erro ao remover lock: ${error.message}`);
    }
  }

  /**
   * Executa o registro facial com proteção de lock
   */
  async executeRegistration() {
    // Verifica se já está rodando
    if (this.isRunning) {
      console.log("⏭️  Execução já em andamento, pulando esta execução...");
      return;
    }

    // Verifica lock de arquivo
    if (this.checkLock()) {
      console.log(
        "⏭️  Lock detectado, outra execução está em andamento. Pulando..."
      );
      return;
    }

    // Cria lock
    this.createLock();
    this.isRunning = true;

    const startTime = Date.now();
    console.log("\n" + "═".repeat(60));
    console.log(`🚀 Iniciando execução do cron job`);
    console.log(`   📅 ${new Date().toLocaleString("pt-BR")}`);
    console.log("═".repeat(60) + "\n");

    try {
      // Cria nova instância do serviço
      this.service = new FacialRegistrationService();
      await this.service.init();

      // Executa registro
      const result = await this.service.registerAllFacesInAllDevices();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Execução concluída em ${duration}s`);
      console.log(`   📊 Resultado: ${result.success ? "Sucesso" : "Falha"}\n`);
    } catch (error) {
      console.error(`\n❌ Erro na execução do cron job: ${error.message}`);
      console.error(error.stack);
    } finally {
      // Libera lock
      this.releaseLock();
      this.isRunning = false;

      // Limpa recursos
      if (
        this.service &&
        this.service.imageProcessor &&
        this.service.imageProcessor.destroy
      ) {
        await this.service.imageProcessor.destroy();
      }
      this.service = null;

      console.log("🔓 Lock liberado, pronto para próxima execução\n");
    }
  }

  /**
   * Inicia o cron job
   */
  start() {
    console.log("\n" + "═".repeat(60));
    console.log("⏰ CRON JOB DE REGISTRO FACIAL");
    console.log("═".repeat(60));
    console.log(`📅 Agendamento: A cada 5 minutos`);
    console.log(`🔒 Proteção: Lock contra execuções sobrepostas`);
    console.log(`💻 PID: ${process.pid}`);
    console.log("═".repeat(60) + "\n");

    // Executa uma vez imediatamente (opcional)
    const runImmediately = process.env.CRON_RUN_IMMEDIATELY !== "false";
    if (runImmediately) {
      console.log("🚀 Executando primeira execução imediatamente...\n");
      this.executeRegistration().catch((error) => {
        console.error("❌ Erro na execução inicial:", error.message);
      });
    }

    // Agenda execuções regulares
    cron.schedule(this.cronExpression, () => {
      this.executeRegistration().catch((error) => {
        console.error("❌ Erro no cron job:", error.message);
      });
    });

    console.log("✅ Cron job iniciado e agendado\n");
  }

  /**
   * Para o cron job
   */
  stop() {
    console.log("\n🛑 Parando cron job...");
    this.releaseLock();
    process.exit(0);
  }
}

// Execução principal
async function main() {
  const cronJob = new FacialRegistrationCron();

  // Tratamento de sinais para limpeza adequada
  process.on("SIGINT", () => {
    console.log("\n📡 Recebido SIGINT, parando cron job...");
    cronJob.stop();
  });

  process.on("SIGTERM", () => {
    console.log("\n📡 Recebido SIGTERM, parando cron job...");
    cronJob.stop();
  });

  // Tratamento de erros não capturados
  process.on("uncaughtException", (error) => {
    console.error("❌ Erro não capturado:", error);
    cronJob.releaseLock();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Promise rejeitada não tratada:", reason);
    cronJob.releaseLock();
  });

  // Inicia cron job
  cronJob.start();
}

if (require.main === module) {
  main();
}

module.exports = FacialRegistrationCron;
