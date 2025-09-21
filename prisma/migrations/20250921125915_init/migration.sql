-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "telegram_username" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "risk_tolerance" DECIMAL(3,1) NOT NULL DEFAULT 5,
    "min_confidence" INTEGER NOT NULL DEFAULT 70,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "passphrase" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "rate_limit_remaining" INTEGER NOT NULL DEFAULT 1200,
    "supported_timeframes" TEXT[],
    "max_candle_history" INTEGER NOT NULL,
    "rate_limits" JSONB NOT NULL,
    "supportedOrderTypes" TEXT[],
    "supports_futures" BOOLEAN NOT NULL DEFAULT true,
    "supports_margin" BOOLEAN NOT NULL DEFAULT true,
    "supports_spot" BOOLEAN NOT NULL DEFAULT true,
    "min_order_size" DOUBLE PRECISION NOT NULL,
    "max_order_size" DOUBLE PRECISION NOT NULL,
    "trading_fees" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" UUID NOT NULL,
    "exchange_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_order_size" DOUBLE PRECISION NOT NULL,
    "max_order_size" DOUBLE PRECISION NOT NULL,
    "tick_size" DOUBLE PRECISION NOT NULL,
    "step_size" DOUBLE PRECISION NOT NULL,
    "last_price" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "volume_24h" DOUBLE PRECISION,
    "change_24h" DOUBLE PRECISION,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "risk_management" JSONB NOT NULL,
    "signal_conditions" JSONB,
    "min_signal_strength" INTEGER NOT NULL DEFAULT 6,
    "max_simultaneous_signals" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_pairs" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "exchange_id" UUID NOT NULL,
    "strategy_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_signal_time" BIGINT NOT NULL DEFAULT 0,
    "total_signals_generated" INTEGER NOT NULL DEFAULT 0,
    "successful_signals" INTEGER NOT NULL DEFAULT 0,
    "last_validation_time" BIGINT NOT NULL DEFAULT 0,
    "validation_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" UUID NOT NULL,
    "pair" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "entry_currency" TEXT NOT NULL DEFAULT 'USDT',
    "targets" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" TEXT[],
    "indicators" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "exchange_id" UUID NOT NULL,
    "trading_pair_id" UUID,
    "strategy_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_metrics" (
    "id" UUID NOT NULL,
    "uptime_ms" BIGINT NOT NULL,
    "signals_generated" INTEGER NOT NULL DEFAULT 0,
    "successful_signals" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memory_usage_mb" DOUBLE PRECISION NOT NULL,
    "cpu_usage_percent" DOUBLE PRECISION NOT NULL,
    "active_pairs_count" INTEGER NOT NULL DEFAULT 0,
    "active_exchanges_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "exchange_latencies" JSONB,
    "signals_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_status" (
    "id" UUID NOT NULL,
    "bot_id" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '2.0.0',
    "status" TEXT NOT NULL DEFAULT 'STOPPED',
    "start_time" TIMESTAMP(3),
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "today_signals_generated" INTEGER NOT NULL DEFAULT 0,
    "total_signals_generated" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_time" TIMESTAMP(3),
    "active_exchanges" TEXT[],
    "active_pairs" TEXT[],
    "configuration" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_performance" (
    "id" UUID NOT NULL,
    "signal_id" UUID NOT NULL,
    "execution_price" DOUBLE PRECISION,
    "exit_price" DOUBLE PRECISION,
    "profit_loss" DOUBLE PRECISION,
    "profit_loss_percent" DOUBLE PRECISION,
    "execution_time" TIMESTAMP(3),
    "exit_time" TIMESTAMP(3),
    "holding_time_minutes" INTEGER,
    "targets_hit" INTEGER[],
    "stop_loss_hit" BOOLEAN NOT NULL DEFAULT false,
    "max_drawdown" DOUBLE PRECISION,
    "max_profit" DOUBLE PRECISION,
    "rating" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signal_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trading_pairs" (
    "id" UUID NOT NULL,
    "trading_pair_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_trading_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_unique" ON "users"("telegram_user_id");

-- CreateIndex
CREATE INDEX "users_telegram_user_id_index" ON "users"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_type_key" ON "exchanges"("type");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_name_key" ON "exchanges"("name");

-- CreateIndex
CREATE INDEX "exchanges_name_index" ON "exchanges"("name");

-- CreateIndex
CREATE INDEX "exchanges_type_index" ON "exchanges"("type");

-- CreateIndex
CREATE INDEX "markets_name_index" ON "markets"("exchange_id");

-- CreateIndex
CREATE INDEX "markets_type_index" ON "markets"("symbol");

-- CreateIndex
CREATE INDEX "markets_is_active_index" ON "markets"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "markets_exchange_id_symbol_key" ON "markets"("exchange_id", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "strategies_name_key" ON "strategies"("name");

-- CreateIndex
CREATE INDEX "strategies_name_index" ON "strategies"("name");

-- CreateIndex
CREATE INDEX "strategies_is_active_index" ON "strategies"("is_active");

-- CreateIndex
CREATE INDEX "trading_pairs_symbol_index" ON "trading_pairs"("symbol");

-- CreateIndex
CREATE INDEX "trading_pairs_exchange_index" ON "trading_pairs"("exchange_id");

-- CreateIndex
CREATE INDEX "trading_pairs_category_index" ON "trading_pairs"("category");

-- CreateIndex
CREATE INDEX "trading_pairs_is_active_index" ON "trading_pairs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "trading_pairs_symbol_exchange_id_key" ON "trading_pairs"("symbol", "exchange_id");

-- CreateIndex
CREATE INDEX "signals_pair_index" ON "signals"("pair");

-- CreateIndex
CREATE INDEX "signals_status_index" ON "signals"("status");

-- CreateIndex
CREATE INDEX "signals_created_at_index" ON "signals"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bot_status_bot_id_key" ON "bot_status"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "signal_performance_signal_id_key" ON "signal_performance"("signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_trading_pairs_trading_pair_id_user_id_key" ON "user_trading_pairs"("trading_pair_id", "user_id");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "trading_pairs_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "trading_pairs_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_trading_pair_id_fkey" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trading_pairs" ADD CONSTRAINT "user_trading_pairs_trading_pair_id_fkey" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trading_pairs" ADD CONSTRAINT "user_trading_pairs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("telegram_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
