import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

@Controller('webhooks/wix')
export class WixWebhookController {
  @Post()
  handleWixWebhook(
    @Headers('x-wix-signature') signature: string,
    @Body() payload: Record<string, unknown>,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    console.log('Received Wix Webhook:', payload);
    return { received: true };
  }
}
