export interface RazorpayWebhookEvent {
    entity: string;
    account_id: string;
    event: string;
    contains: string[];
    payload: {
        payment: {
            entity: RazorpayPaymentEntity;
        };
        order?: {
            entity: RazorpayOrderEntity;
        };
    };
    created_at: number;
}

export interface RazorpayPaymentEntity {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    invoice_id: string | null;
    international: boolean;
    method: string;
    amount_refunded: number;
    refund_status: string | null;
    captured: boolean;
    description: string | null;
    card_id: string | null;
    bank: string | null;
    wallet: string | null;
    vpa: string | null;
    email: string;
    contact: string;
    notes: Record<string, any>;
    fee: number;
    tax: number;
    error_code: string | null;
    error_description: string | null;
    error_source: string | null;
    error_step: string | null;
    error_reason: string | null;
    acquirer_data: Record<string, any>;
    created_at: number;
}

export interface RazorpayOrderEntity {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    offer_id: string | null;
    status: string;
    attempts: number;
    notes: Record<string, any>;
    created_at: number;
}