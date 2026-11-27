from django.db import migrations


COASTAL_DESTINATIONS = [
    {
        'name': 'Malindi',
        'slug': 'malindi',
        'category': 'beach_coastal_escapes',
        'badge': 'Coastal Escape',
        'duration': '',
        'hook': 'Explore Indian Ocean beaches, coral reefs, and historic coastal heritage in Malindi.',
        'highlights': [
            'Malindi Marine National Park',
            'Swahili coast heritage',
            'Indian Ocean beaches',
        ],
        'cta_label': 'Explore Malindi',
        'starting_price': None,
        'images': [],
        'visible': True,
        'featured_on_home': False,
        'sort_order': 15,
    },
    {
        'name': 'Mombasa',
        'slug': 'mombasa',
        'category': 'beach_coastal_escapes',
        'badge': 'Coastal City',
        'duration': '',
        'hook': 'Discover historic Old Town, Fort Jesus, and the beaches along Kenya’s coast.',
        'highlights': [
            'Fort Jesus and Old Town',
            'Indian Ocean beaches',
            'Swahili coastal culture',
        ],
        'cta_label': 'Explore Mombasa',
        'starting_price': None,
        'images': [],
        'visible': True,
        'featured_on_home': False,
        'sort_order': 16,
    },
]


def spell_out_and(value):
    if isinstance(value, str):
        return value.replace('&', 'and')
    if isinstance(value, list):
        return [spell_out_and(item) for item in value]
    return value


def update_coastal_destinations(apps, schema_editor):
    Destination = apps.get_model('api', 'Destination')
    Safari = apps.get_model('api', 'Safari')

    for data in COASTAL_DESTINATIONS:
        Destination.objects.get_or_create(slug=data['slug'], defaults=data)

    Destination.objects.filter(
        slug__in=['diani-beach-south-coast', 'lamu-island'],
    ).update(category='beach_coastal_escapes')

    for destination in Destination.objects.all().iterator():
        updates = {}
        for field in ('name', 'badge', 'duration', 'hook', 'highlights', 'cta_label'):
            value = getattr(destination, field)
            updated_value = spell_out_and(value)
            if updated_value != value:
                updates[field] = updated_value
        if updates:
            Destination.objects.filter(pk=destination.pk).update(**updates)

    mara = Destination.objects.filter(slug='maasai-mara-national-reserve').first()
    if mara:
        unwanted_packages = Safari.objects.filter(title__icontains='trasha falls')
        mara.safaris.remove(*unwanted_packages)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_alter_destination_category'),
    ]

    operations = [
        migrations.RunPython(update_coastal_destinations, migrations.RunPython.noop),
    ]
