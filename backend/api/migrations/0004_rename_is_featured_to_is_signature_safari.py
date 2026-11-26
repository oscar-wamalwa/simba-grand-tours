# Generated migration to rename is_featured to is_signature for Safari model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_testimonial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='safari',
            old_name='is_featured',
            new_name='is_signature',
        ),
    ]

