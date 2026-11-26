from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0005_safari_details'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contactmessage',
            name='email',
            field=models.EmailField(blank=True, default='no-reply@simbagrandtours.com', max_length=254, null=True),
        ),
        migrations.AlterField(
            model_name='contactmessage',
            name='message',
            field=models.TextField(blank=True, null=True),
        ),
    ]
