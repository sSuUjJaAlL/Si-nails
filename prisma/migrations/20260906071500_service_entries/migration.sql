-- CreateTable
CREATE TABLE "service_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_entries_date_idx" ON "service_entries"("date");

-- CreateIndex
CREATE INDEX "service_entries_employeeId_idx" ON "service_entries"("employeeId");

-- CreateIndex
CREATE INDEX "service_entries_paymentType_idx" ON "service_entries"("paymentType");

-- AddForeignKey
ALTER TABLE "service_entries" ADD CONSTRAINT "service_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
