from django.db import migrations


def add_country_prefix_plus(apps, schema_editor):
    Subscriber = apps.get_model('api', 'Subscriber')
    database = schema_editor.connection.alias
    for subscriber in Subscriber.objects.using(database).filter(phone__startswith='254').iterator():
        subscriber.phone = f'+{subscriber.phone}'
        subscriber.save(update_fields=['phone'])


def remove_country_prefix_plus(apps, schema_editor):
    Subscriber = apps.get_model('api', 'Subscriber')
    database = schema_editor.connection.alias
    for subscriber in Subscriber.objects.using(database).filter(phone__startswith='+254').iterator():
        subscriber.phone = subscriber.phone[1:]
        subscriber.save(update_fields=['phone'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_subscriber_phone_sms_consent'),
    ]

    operations = [
        migrations.RunPython(add_country_prefix_plus, remove_country_prefix_plus),
    ]
