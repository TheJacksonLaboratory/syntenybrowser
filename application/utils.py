def _dictify_row(cursor, row):
    """turns the given row into a dictionary where the keys are the column names"""
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}
