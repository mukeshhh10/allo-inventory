import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  product: z
    .object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      imageUrl: z.string().nullable().optional(),
    })
    .optional(),
  warehouse: z
    .object({
      id: z.string(),
      name: z.string(),
      location: z.string(),
    })
    .optional(),
});

export type Reservation = z.infer<typeof ReservationSchema>;
