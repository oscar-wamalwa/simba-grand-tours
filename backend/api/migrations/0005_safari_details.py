from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0004_rename_is_featured_to_is_signature_safari'),
    ]

    operations = [
        migrations.AddField(
            model_name='safari',
            name='exclusions',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='safari',
            name='inclusions',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='safari',
            name='itinerary',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
