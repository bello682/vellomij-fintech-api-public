-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "recipientAccount" TEXT,
ADD COLUMN     "recipientBank" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "senderAccount" TEXT,
ADD COLUMN     "senderBank" TEXT DEFAULT 'Vellomij Bank',
ADD COLUMN     "senderName" TEXT;
