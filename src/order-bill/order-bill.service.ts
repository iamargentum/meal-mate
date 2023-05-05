import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrderBill } from './order-bill.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateOrderBillDto } from './dto/create-order-bill.dto';
import { OrderService } from 'src/order/order.service';
import { MathService } from '../shared/math.service';
import { AmountType } from './types/discount.type';
import { Order } from 'src/order/order.entity';
import { OrderDish } from 'src/order/order-dish.entity';

@Injectable()
export class OrderBillService {
  constructor(
    @InjectRepository(OrderBill)
    private readonly orderBillRepository: Repository<OrderBill>,
    private readonly orderService: OrderService,
    private readonly mathService: MathService,
  ) {}

  async getOrderBill(orderId: string): Promise<OrderBill> {
    return this.orderBillRepository.findOne({
      where: {
        orderId,
      },
    });
  }

  async createOrderBill(
    orderId: string,
    orderBill: CreateOrderBillDto,
  ): Promise<OrderBill> {
    const order = await this.orderService.getOrder(orderId);
    if (!order) {
      throw new BadRequestException('Invalid order ID');
    }

    const totalOrderedDishesPrice = order.orderDishes.reduce(
      (totalDishPrice, orderedDish) => totalDishPrice + orderedDish.dish.price,
      0,
    );
    const calculatedNetAmount = this.mathService
      .setInitialAmount(totalOrderedDishesPrice)
      .applyCharge(orderBill.tax, AmountType.PERCENTAGE)
      .applyCharge(orderBill.serviceCharge, orderBill.serviceChargeType)
      .applyDiscount(orderBill.discount, orderBill.discountType)
      .add(orderBill.tip)
      .getTotal();

    if (calculatedNetAmount !== orderBill.netAmount) {
      throw new BadRequestException(
        'The passed net amount does not match the calculated net amount',
      );
    }

    const newOrderBill = new OrderBill();
    newOrderBill.orderId = orderId;
    newOrderBill.order = order;
    newOrderBill.mealCharges = totalOrderedDishesPrice;
    newOrderBill.serviceChargeType = orderBill.serviceChargeType;
    newOrderBill.serviceCharge = orderBill.serviceCharge;
    newOrderBill.tip = orderBill.tip;
    newOrderBill.tax = orderBill.tax;
    newOrderBill.discountType = orderBill.discountType;
    newOrderBill.discount = orderBill.discount;
    newOrderBill.netAmount = orderBill.netAmount;
    newOrderBill.paidBy = orderBill.paidBy;
    newOrderBill.paymentMethod = orderBill.paymentMethod;
    return this.orderBillRepository.save(newOrderBill);
  }
}
