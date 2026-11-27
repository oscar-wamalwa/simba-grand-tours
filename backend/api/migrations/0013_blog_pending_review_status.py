from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_booking_fee_terms_and_balance'),
    ]

    operations = [
        migrations.AlterField(
            model_name='blog',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('pending_review', 'Pending review'),
                    ('published', 'Published'),
                ],
                default='draft',
                max_length=20,
            ),
        ),
    ]
