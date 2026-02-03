from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
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
    manual_category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    card_account = relationship("CardAccount", back_populates="transactions")
    import_batch = relationship("ImportBatch", back_populates="transactions")
    merchant = relationship("Merchant", back_populates="transactions")
    manual_category = relationship("Category", foreign_keys=[manual_category_id])


Index("ix_transactions_transaction_date", Transaction.transaction_date)
Index("ix_transactions_merchant_id", Transaction.merchant_id)


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    last4: Mapped[Optional[str]] = mapped_column(String(4))
    currency: Mapped[Optional[str]] = mapped_column(String(3))

    import_batches = relationship("BankActivityImportBatch", back_populates="bank_account")
    activities = relationship("BankActivity", back_populates="bank_account")


class BankActivityCategory(Base):
    __tablename__ = "bank_activity_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    payee_links = relationship("BankPayeeCategoryMap", back_populates="category")


class BankPayee(Base):
    __tablename__ = "bank_payees"

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)

    activities = relationship("BankActivity", back_populates="payee")
    category_links = relationship("BankPayeeCategoryMap", back_populates="payee")


class BankPayeeCategoryMap(Base):
    __tablename__ = "bank_payee_category_map"

    id: Mapped[int] = mapped_column(primary_key=True)
    payee_id: Mapped[int] = mapped_column(ForeignKey("bank_payees.id"), unique=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("bank_activity_categories.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    payee = relationship("BankPayee", back_populates="category_links")
    category = relationship("BankActivityCategory", back_populates="payee_links")


class BankActivityImportBatch(Base):
    __tablename__ = "bank_activity_import_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"))
    source_filename: Mapped[Optional[str]] = mapped_column(String(255))
    period_month: Mapped[Date] = mapped_column(Date, nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    uploaded_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    bank_account = relationship("BankAccount", back_populates="import_batches")
    activities = relationship("BankActivity", back_populates="import_batch")


class BankActivityImportDraft(Base):
    __tablename__ = "bank_activity_import_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"))
    source_filename: Mapped[Optional[str]] = mapped_column(String(255))
    period_month: Mapped[Date] = mapped_column(Date, nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    bank_account = relationship("BankAccount")
    rows = relationship(
        "BankActivityImportDraftRow",
        back_populates="draft",
        cascade="all, delete-orphan",
    )


class BankActivityImportDraftRow(Base):
    __tablename__ = "bank_activity_import_draft_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_id: Mapped[int] = mapped_column(
        ForeignKey("bank_activity_import_drafts.id", ondelete="CASCADE")
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    activity_date: Mapped[Date] = mapped_column(Date, nullable=False)
    value_date: Mapped[Optional[Date]] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(50))
    payee_raw: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_payee: Mapped[str] = mapped_column(String(200), nullable=False)
    debit: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    credit: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    balance: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    currency: Mapped[Optional[str]] = mapped_column(String(3))
    raw_category_text: Mapped[Optional[str]] = mapped_column(Text)
    suggested_category_text: Mapped[Optional[str]] = mapped_column(Text)
    approved_category_text: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    draft = relationship("BankActivityImportDraft", back_populates="rows")


class BankActivity(Base):
    __tablename__ = "bank_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"))
    import_batch_id: Mapped[int] = mapped_column(ForeignKey("bank_activity_import_batches.id"))
    activity_date: Mapped[Date] = mapped_column(Date, nullable=False)
    value_date: Mapped[Optional[Date]] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(50))
    payee_raw: Mapped[str] = mapped_column(Text, nullable=False)
    payee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("bank_payees.id"))
    debit: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    credit: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    balance: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2))
    currency: Mapped[Optional[str]] = mapped_column(String(3))
    manual_category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("bank_activity_categories.id")
    )
    raw_category_text: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    bank_account = relationship("BankAccount", back_populates="activities")
    import_batch = relationship("BankActivityImportBatch", back_populates="activities")
    payee = relationship("BankPayee", back_populates="activities")
    manual_category = relationship(
        "BankActivityCategory", foreign_keys=[manual_category_id]
    )


Index("ix_bank_activities_activity_date", BankActivity.activity_date)
Index("ix_bank_activities_payee_id", BankActivity.payee_id)
