## USE OF AI

1. Used ChatGPT to generate the data cleaning script using the following prompt:

```
- check the data/archive that's where the file original_data.csv is Remove rural areas
- convert every record on the order_time column to be in hour only. i.e 8:54am is 8am. and 7:45pm is 7pm.
- Disregard all other columns except store_location_type, region, day_of_week, order_time
- Nowdo aggregation by region, then location type(locale), then by day(throughout the whole data), and by hour throughout that day throughout the whole data. 

I'm not sure if i understand what i mean: basically what i hope to get at the end is data showing me:
In NorthEast on Monday at 7pm in Surbuban starbucks we average 15 orders.
```