from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class CardAccount(Base):
    __tablename__ = "card_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    issuer: Mapped[Optional[str]] = mapped_column(String(100))
    last4: Mapped[Optional[str]] = mapped_column(String(4))

    import_batches = relationship("ImportBatch", back_populates="card_account")
    transactions = relationship("Transaction", back_populates="card_account")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    merchant_links = relationship("MerchantCategoryMap", back_populates="category")


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)

    transactions = relationship("Transaction", back_populates="merchant")
    category_links = relationship("MerchantCategoryMap", back_populates="merchant")


class MerchantCategoryMap(Base):
    __tablename__ = "merchant_category_map"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), unique=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    merchant = relationship("Merchant", back_populates="category_links")
    category = relationship("Category", back_populates="merchant_links")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_account_id: Mapped[int] = mapped_column(ForeignKey("card_accounts.id"))
    source_filename: Mapped[Optional[str]] = mapped_column(String(255))
    period_month: Mapped[Date] = mapped_column(Date, nullable=False)
    uploaded_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    card_account = relationship("CardAccount", back_populates="import_batches")
    transactions = relationship("Transaction", back_populates="import_batch")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_account_id: Mapped[int] = mapped_column(ForeignKey("card_accounts.id"))
    import_batch_id: Mapped[int] = mapped_column(ForeignKey("import_batches.id"))
    transaction_date: Mapped[Date] = mapped_column(Date, nullable=False)
    posting_date: Mapped[Optional[Date]] = mapped_column(Date)
    merchant_raw: Mapped[str] = mapped_column(Text, nullable=False)
    merchant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("merchants.id"))
    transaction_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    charged_amount: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    charged_currency: Mapped[Optional[str]] = mapped_column(String(3))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    card_account = relationship("CardAccount", back_populates="transactions")
    import_batch = relationship("ImportBatch", back_populates="transactions")
    merchant = relationship("Merchant", back_populates="transactions")


Index("ix_transactions_transaction_date", Transaction.transaction_date)
Index("ix_transactions_merchant_id", Transaction.merchant_id)
