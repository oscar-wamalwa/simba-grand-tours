from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_blog_pending_review_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriber',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='subscriber',
            name='sms_opt_in',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='subscriber',
            name='sms_opt_in_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
